#include <Arduino.h>

#include "drivers/indicators.h"
#include "osape/utils/cobs.h"
#include "osape/osap/osap.h"

OSAP* osap = new OSAP("cz head");
#include "osape/osap/vport_usbserial.h"
VPort_USBSerial* vPortSerial = new VPort_USBSerial(); // 8 frames input, 1028 bytes each

#include "osape/utils/clocks_d51.h"
#include "osape/ucbus/ucbus_head.h"

// should eventually just be this, 
#include "smoothie/SmoothieRoll.h"

union chunk_float32 {
  uint8_t bytes[4];
  float f;
};

union chunk_uint32 {
  uint8_t bytes[4];
  uint32_t u;
};

// adhoc reply 
uint8_t reply[1024];
uint16_t rl = 0;

uint8_t replyBlankPck[1024];
uint16_t replyBlankPl = 0;
uint16_t replyBlankPtr = 0;
uint16_t replyBlankSegsize = 0;
VPort* replyBlankVp;
uint16_t replyBlankVpi = 0;
uint16_t lastQueueSpaceTxd = 0;

boolean needNewEmptySpaceReply = false;

boolean smoothie_is_queue_empty(void){
  return conveyor->queue.is_empty();
}

boolean smoothie_is_moving(void){
  return (smoothieRoll->actuators[0]->is_moving() 
        || smoothieRoll->actuators[1]->is_moving() 
        || smoothieRoll->actuators[2]->is_moving()
        || !smoothie_is_queue_empty());
}

// pck[ptr] == DK_APP
void OSAP::handleAppPacket(uint8_t *pck, uint16_t pl, uint16_t ptr, uint16_t segsize, VPort* vp, uint16_t vpi, uint8_t pwp){
  // track end of header, to reply with 
  uint16_t replyPtr = ptr;
  // (a hack) store one app packet, to format our replies with. do once 
  if(replyBlankPtr == 0){
    for(uint16_t i = 0; i < pl; i++){
      replyBlankPck[i] = pck[i];
    }
    replyBlankPl = pl;
    replyBlankPtr = ptr;
    replyBlankSegsize = segsize;
    replyBlankVp = vp;
    replyBlankVpi = vpi;
  }
  // clear out our reply,   
  rl = 0;
  reply[rl ++] = DK_APP;
  // do the reading:
  ptr ++; // walk appcode DK_APP
  switch(pck[ptr]){
    case AK_GOTOPOS: {
        ptr ++; // walk mocode 
        reply[rl ++] = AK_GOTOPOS;
        // get positions 
        chunk_float32 targetChunks[3];
        targetChunks[0] = { .bytes = { pck[ptr ++], pck[ptr ++], pck[ptr ++], pck[ptr ++] } };
        targetChunks[1] = { .bytes = { pck[ptr ++], pck[ptr ++], pck[ptr ++], pck[ptr ++] } };
        targetChunks[2] = { .bytes = { pck[ptr ++], pck[ptr ++], pck[ptr ++], pck[ptr ++] } };
        // get feed 
        chunk_float32 feedrateChunk = { .bytes = { pck[ptr ++], pck[ptr ++], pck[ptr ++], pck[ptr ++] } };
        if(feedrateChunk.f < 0.01){
          sysError("ZERO FR");
        }
        // can load move? 
        if(!(conveyor->is_queue_full())){
          // do load 
          // need to get last position from each, to do increment calc for planner 
          // that can all go in the planner, 
          float target[3] = {targetChunks[0].f, targetChunks[1].f, targetChunks[2].f};
          //sysError("targets, rate: " + String(target[0], 6) + ", " + String(target[1], 6) + ", " + String(target[2], 6) + ", " + String(feedrateChunk.f, 6));
          planner->append_move(target, 3, feedrateChunk.f);
        } else {
          // if we flowcontrol properly, this shouldn't appear 
          sysError("WRITE FULL");
        }
        // reply if not full after push, 
        if(conveyor->is_queue_full()){
          // full, 
          needNewEmptySpaceReply = true;
        } else {
          ts_writeBoolean(true, reply, &rl);
        }
      }
      break;
    case AK_SETPOS:
      // only when queue empty and not moving, set current position 
      reply[rl ++] = AK_SETPOS;
      // these are cancelled for now ... or ? are they ?
      if(false){
        reply[rl ++] = AK_ERR;
        ts_writeString("setPos remote is cancelled, use deltas from query'd position", reply, &rl);
      } else if(smoothie_is_moving()){
        reply[rl ++] = AK_ERR;
        ts_writeString("motion is happening, cannot set position on the fly", reply, &rl);
      } else {
        // will require that you operate a new bus command. 
        if(ucBusHead->cts_b() && !smoothie_is_moving()){
          ptr ++;
          // same as currents, we can forward these posns', 
          //ucBusHead->transmit_b(&(pck[ptr]), 13);
          // but also need to set our own position to this... 
          chunk_float32 setChunks[3];
          setChunks[0] = { .bytes = { pck[ptr ++], pck[ptr ++], pck[ptr ++], pck[ptr ++] } };
          setChunks[1] = { .bytes = { pck[ptr ++], pck[ptr ++], pck[ptr ++], pck[ptr ++] } };
          setChunks[2] = { .bytes = { pck[ptr ++], pck[ptr ++], pck[ptr ++], pck[ptr ++] } };
          // meaning...
          // I'm not 100% on this code, will ofc test when homing is tested 
          float set[3] = {setChunks[0].f, setChunks[1].f, setChunks[2].f};
          planner->set_position(set, 3);
          sysError("SET: " + String(setChunks[0].f, 3) + " " + String(setChunks[1].f, 3) + " " + String(setChunks[2].f, 3));
          // and reply OK 
          reply[rl ++] = AK_OK;
        }
      }
      break;
    case AK_SETWAITTIME:{
        reply[rl ++] = AK_SETWAITTIME;
        ptr ++;
        chunk_uint32 setChunk = { .bytes = { pck[ptr ++], pck[ptr ++], pck[ptr ++], pck[ptr ++] } };
        conveyor->setWaitTime(setChunk.u);
        break;
      }
    case AK_QUERYMOVING:
      // is currently ticking?
      reply[rl ++] = AK_QUERYMOVING;
      if(smoothieRoll->actuators[0]->is_moving() || smoothieRoll->actuators[1]->is_moving() || smoothieRoll->actuators[2]->is_moving()){
        ts_writeBoolean(true, reply, &rl);
      } else {
        ts_writeBoolean(false, reply, &rl);
      }
      break;
    case AK_QUERYPOS:
      reply[rl ++] = AK_QUERYPOS;
      ts_writeFloat32(smoothieRoll->actuators[0]->floating_position, reply, &rl);
      ts_writeFloat32(smoothieRoll->actuators[1]->floating_position, reply, &rl);
      ts_writeFloat32(smoothieRoll->actuators[2]->floating_position, reply, &rl);
    case AK_QUERYQUEUELEN: {
        reply[rl ++] = AK_QUERYQUEUELEN;
        // length of queue is 64 - available space 
        uint16_t ql = 64 - conveyor->queue_space(); 
        ts_writeUint16(ql, reply, &rl);
      }
      break;
    // downstream / bus... 
    case AK_SETCURRENT:
      // should be able to put a new current-write out on the B channel,
      // so long as it's clear 
      reply[rl ++] = AK_SETCURRENT;
      if(ucBusHead->cts_b()){
        // this is basically a forward, or should be, 
        // pck[ptr] == AK_SETCURRENT, + 3*4 wide floats
        // we can actually do this direct from pck -> bus outbuffer 
        ucBusHead->transmit_b(&(pck[ptr]), 13);
        reply[rl ++] = AK_OK;
      } else {
        reply[rl ++] = AK_ERR;
        ts_writeString("ucbus b-channel not clear, cannot write currents", reply, &rl);
      }
      break;
    case AK_SETRPM:
      // spindle rpm change 
      reply[rl ++] = AK_SETRPM;
      if(ucBusHead->cts_b()){ // this is aaaaahn float, or uint32, either way: 
        ucBusHead->transmit_b(&(pck[ptr]), 5);
        reply[rl ++] = AK_OK;
      } else {
        reply[rl ++] = AK_ERR;
        ts_writeString("ucbus b-channel not clear, cannot write rpm", reply, &rl);
      }
      break;
    case AK_SET_TC: 
      // set motor torque downstream 
      reply[rl ++] = AK_SET_TC;
      if(ucBusHead->cts_b()){ // this is aaaaahn float, or uint32, either way: 
        ucBusHead->transmit_b(&(pck[ptr]), 5);
        reply[rl ++] = AK_OK;
      } else {
        reply[rl ++] = AK_ERR;
        ts_writeString("ucbus b-channel not clear, cannot write rpm", reply, &rl);
      }
      break;
    case AK_RUNCALIB:
      // set motor torque downstream 
      reply[rl ++] = AK_RUNCALIB;
      if(ucBusHead->cts_b()){ // this is aaaaahn float, or uint32, either way: 
        ucBusHead->transmit_b(&(pck[ptr]), 5);
        reply[rl ++] = AK_OK;
      } else {
        reply[rl ++] = AK_ERR;
        ts_writeString("ucbus b-channel not clear, cannot write rpm", reply, &rl);
      }
      break;
    default:
      sysError("nonreq. appkey " + String(pck[ptr]));
      break;
  }// end pck ptr switch 
  // check if should issue reply 
  if(rl > 1){
    if(vp->cts()){
      appReply(pck, pl, replyPtr, segsize, vp, vpi, reply, rl);
    } else {
      sysError("on reply, not cts, system fails");
    }
  }
  // always do, 
  vp->clearPacket(pwp);
  /*
  uint16_t qs = conveyor->queue_space();
  lastQueueSpaceTxd = qs;
  ts_writeUint16(qs, reply, &rl);
  // ship the reply   
  */
}

void setup() {
  ERRLIGHT_SETUP;
  CLKLIGHT_SETUP;
  DEBUG1PIN_SETUP;
  DEBUG2PIN_SETUP;
  DEBUG3PIN_SETUP;
  DEBUG4PIN_SETUP;
  // osap
  osap->description = "smoothie port and stepper driver";
  osap->addVPort(vPortSerial);
  // bus 
  ucBusHead->init();
  // smoothie 
  smoothieRoll->init();
  // 100kHz base (10us period)
  d51_clock_boss->start_ticker_a(10);
}

volatile uint8_t tick_count = 0;

// TODO: this should be volatile, no? 
uint8_t motion_packet[64]; // three floats bb, space 

void TC0_Handler(void){
  // runs at 100KHz (10us period), eats about 2.5us, or 5 if the transmit occurs 
  DEBUG1PIN_ON;
  TC0->COUNT32.INTFLAG.bit.MC0 = 1;
  TC0->COUNT32.INTFLAG.bit.MC1 = 1;
  tick_count ++;
  // do bus action first: want downstream clocks to be deterministic-ish
  ucBusHead->timerISR(); // transmits one full word at this HZ. 
  // do step tick 
  smoothieRoll->step_tick();
  // every n ticks, ship position? 
  if(tick_count > 20){
    tick_count = 0;
    uint16_t mpptr = 0; // motion packet pointer 
    if(planner->do_set_position){
      motion_packet[mpptr ++] = UB_AK_SETPOS;
      planner->do_set_position = false;
    } else {
      motion_packet[mpptr ++] = UB_AK_GOTOPOS;
    }
    ts_writeFloat32(smoothieRoll->actuators[0]->floating_position, motion_packet, &mpptr);
    ts_writeFloat32(smoothieRoll->actuators[1]->floating_position, motion_packet, &mpptr);
    ts_writeFloat32(smoothieRoll->actuators[2]->floating_position, motion_packet, &mpptr);
    // write packet, put on ucbus
    //DEBUG3PIN_ON;
    ucBusHead->transmit_a(motion_packet, 13);
    //DEBUG3PIN_OFF;
  }
  DEBUG1PIN_OFF;
}

uint8_t testTxBytes[4] = {0, 2, 4, 8};
uint8_t testTxLen = 4;

uint8_t dropRead = 0;
uint8_t testRxBytes[1024];
uint16_t testRxLen = 0;

uint64_t lastTransmit = 0;
uint64_t lastRead = 0;

uint16_t queueCheck = 0;

uint32_t time = 0;
uint32_t lastTime = 0;
boolean once = true;

#define SQUARE_SIDELEN 5.0F
#define OFFSET 0.0F

// dummy moves 
uint8_t squareMove = 3;
float square[4][3] = {
  {0.0F + OFFSET, 0.0F + OFFSET, 0.0F + OFFSET},
  {0.0F + OFFSET, SQUARE_SIDELEN + OFFSET, 0.0F + OFFSET},
  {SQUARE_SIDELEN + OFFSET, SQUARE_SIDELEN + OFFSET, 0.0F + OFFSET},
  {SQUARE_SIDELEN + OFFSET, 0.0F + OFFSET, 0.0F + OFFSET}
};

float spot = 1;
float dummyTarget = 1;

void loop() {
  //DEBUG2PIN_TOGGLE;
  osap->loop();
  conveyor->on_idle(nullptr);
  // return new info? 
  // stepper-at-head spaces return 
  if(needNewEmptySpaceReply && !(conveyor->is_queue_full())){
    rl = 0;
    reply[rl ++] = DK_APP;
    reply[rl ++] = AK_GOTOPOS;
    ts_writeBoolean(true, reply, &rl);
    osap->appReply(replyBlankPck, replyBlankPl, replyBlankPtr, replyBlankSegsize, replyBlankVp, replyBlankVpi, reply, rl);
    needNewEmptySpaceReply = false;
  }
  /*
  queueCheck = conveyor->queue_space();
  if(queueCheck > lastQueueSpaceTxd){
    if(replyBlankPl > 0 && replyBlankVp->cts()){
      rl = 0;
      reply[rl ++] = DK_APP;
      lastQueueSpaceTxd = queueCheck;
      ts_writeUint16(lastQueueSpaceTxd, reply, &rl);
      osap->appReply(replyBlankPck, replyBlankPl, replyBlankPtr, replyBlankSegsize, replyBlankVp, replyBlankVpi, reply, rl);
    }
  }
  */

  // for periodic debug,   
  time = millis();
  if(time > lastTime + 10){
    lastTime = time;
    //DEBUG3PIN_TOGGLE;
    //DEBUG4PIN_TOGGLE;
    if(!(conveyor->is_queue_full()) && false){  
      //sysError("position: " + String(smoothieRoll->actuators[0]->floating_position) 
      //                + " " + String(smoothieRoll->actuators[1]->floating_position));
      squareMove ++;
      if(squareMove > 3){
        squareMove = 0;
      }
      //sysError("append: " + String(squareMove) + " " + String(square[squareMove][0]) + " " + String(square[squareMove][1]) + " " + String(square[squareMove][2]));
      planner->append_move(square[squareMove], 3, 10);
      // set flag for 'process immediate' 
      // or run another line to remote-set the queue_delay_time_ms 
      // conveyor::line 223 
      /*
      // thru append_move 
      float dummyPos[3];
      for(uint8_t m = 0; m < 3; m ++){
        dummyPos[m] = dummyTarget;
      }
      dummyTarget += spot;
      spot += 1;
      if(spot > 5){
        spot = 1;
      }
      planner->append_move(dummyPos, 3, 1);
      */
      /*
      // thru append_block 
      ActuatorCoordinates feedPos;
      float sos = powf(spot, 2) * 3;
      float dist = sqrtf(sos);
      float unit[3] = {1 / dist, 1 / dist, 1 / dist};
      float s_value = 10;
      // step, 
      for(uint8_t i = 0; i < k_max_actuators; i ++){
        feedPos[i] = spot;
      }
      planner->append_block(feedPos, 3, 100, dist, unit, 10, s_value, true);
      */
    }
  }
} // end loop 
