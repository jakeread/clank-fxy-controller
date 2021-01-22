#include <Arduino.h>

#include "drivers/indicators.h"
#include "osape/osap/osap.h"

#include "osape/utils/clocks_d51.h"
#include "osape/ucbus/ucbus_head.h"

// should eventually just be this, 
#include "smoothie/SmoothieRoll.h"

// osap 
OSAP* osap = new OSAP("cz head");
#include "osape/osap/vport_usbserial.h"
VPort_USBSerial* vPortSerial = new VPort_USBSerial(); 
#include "osape/osap/vport_ucbus_head.h"
VPort_UCBus_Head* vPortUcBusHead = new VPort_UCBus_Head();

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

// these should be in the smoothieroll / module 
boolean smoothie_is_queue_empty(void){
  return conveyor->queue.is_empty();
}

boolean smoothie_is_moving(void){
  return (smoothieRoll->actuators[0]->is_moving() 
        || smoothieRoll->actuators[1]->is_moving() 
        || smoothieRoll->actuators[2]->is_moving()
        || !smoothie_is_queue_empty());
}

uint16_t testCount = 0;
uint8_t testPacket[8] = {1, 3, 5, 7, 9, 13, 17, 23};
uint8_t testReturnPacket[1024];

// pck[ptr] == DK_APP
// app packets depricated in favour of endpoints 
void OSAP::handleAppPacket(uint8_t *pck, uint16_t ptr, pckm_t* pckm){
  pckm->vpa->clear(pckm->location);
}

// -------------------------------------------------------- OSAP ENDPOINTS TEST

unsigned long wait = 500;
unsigned long last = millis();

boolean onTestData(uint8_t* data, uint16_t len){
  // test test, 
  unsigned long now = millis();
  if(last + wait < now){
    last = now;
    return true;
  } else {
    return false;
  }
}
Endpoint* testEP = osap->endpoint(onTestData);
uint8_t qtest[6] = { 12, 24, 48, 96, 48, 24 };

boolean onMoveData(uint8_t* data, uint16_t len){
  // can we load it?
  if(!conveyor->is_queue_full()){
    // read from head, 
    uint16_t ptr = 0;
    // feedrate is 1st, 
    chunk_float32 feedrateChunk = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
    // get positions XYZE
    chunk_float32 targetChunks[4];
    targetChunks[0] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
    targetChunks[1] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
    targetChunks[2] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
    targetChunks[3] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
    // check and load, 
    if(feedrateChunk.f < 0.01){
      sysError("ZERO FR");
      return true; // ignore this & ack 
    } else {
      // do load 
      float target[3] = {targetChunks[0].f, targetChunks[1].f, targetChunks[2].f };
      //sysError("targets, rate: " + String(target[0], 6) + ", " + String(target[1], 6) + ", " + String(target[2], 6) + ", " + String(feedrateChunk.f, 6));
      planner->append_move(target, SR_NUM_MOTORS, feedrateChunk.f / 60, targetChunks[3].f); // mm/min -> mm/sec 
      return true; 
    }
  } else {
    // await, try again next loop 
    return false;
  }
}
Endpoint* moveEP = osap->endpoint(onMoveData);

boolean onPositionData(uint8_t* data, uint16_t len){
  // don't do anything with this, but would use it to set 
  return true;
}
Endpoint* posEP = osap->endpoint(onPositionData);

// -------------------------------------------------------- SETUP 

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
  osap->addVPort(vPortUcBusHead);
  // smoothie 
  smoothieRoll->init();
  // 100kHz base (10us period)
  d51_clock_boss->start_ticker_a(10);
  // ... 
  testEP->write(qtest, 6);

  ERRLIGHT_ON;
  CLKLIGHT_ON;
}

uint32_t ledTickCount = 0;
void loop() {
  //DEBUG2PIN_TOGGLE;
  osap->loop();
  conveyor->on_idle(nullptr);
  // blink
  ledTickCount ++;
  if(ledTickCount > 1024){
    // write new pos data periodically, 
    uint8_t posData[16];
    uint16_t poswptr = 0;
    ts_writeFloat32(smoothieRoll->actuators[0]->floating_position, posData, &poswptr);
    ts_writeFloat32(smoothieRoll->actuators[1]->floating_position, posData, &poswptr);
    ts_writeFloat32(smoothieRoll->actuators[2]->floating_position, posData, &poswptr);
    ts_writeFloat32(smoothieRoll->actuators[3]->floating_position, posData, &poswptr);
    posEP->write(posData, 16);
    // blink 
    DEBUG1PIN_TOGGLE;
    ledTickCount = 0;
  }
} // end loop 

/*
ERRLIGHT_TOGGLE;
uint16_t wptr = 0;
txpck[wptr ++] = DK_VMODULE;
ts_writeUint16(0, txpck, &wptr);    // from the 0th software module at this node, 
ts_writeUint16(0, txpck, &wptr);    // and the 0th data object there
ts_writeUint16(0, txpck, &wptr);    // to the 0th software module at end of route, 
ts_writeUint16(0, txpck, &wptr);    // and the 0th data object there 
// type it, and write it 
txpck[wptr ++] = TK_UINT32;
float reading = readThermA(); // PA04 is our THERM_A, analog pin 4 in arduino land 
ts_writeFloat32(reading, txpck, &wptr);
// transmit, 
osap->send(txroute, 11, 512, txpck, wptr);
*/

// runs on period defined by timer_a setup: 
volatile uint8_t tick_count = 0;
uint8_t motion_packet[64]; // three floats bb, space 
float extruder_virtual = 0;

void TC0_Handler(void){
  // runs at 100KHz (10us period), eats about 2.5us, or 5 if the transmit occurs 
  TC0->COUNT32.INTFLAG.bit.MC0 = 1;
  TC0->COUNT32.INTFLAG.bit.MC1 = 1;
  tick_count ++;
  // do bus action first: want downstream clocks to be deterministic-ish
  ucBusHead->timerISR(); // transmits one full word at this HZ. 
  // do step tick 
  smoothieRoll->step_tick();
  // every n ticks, ship position? 
  if(tick_count > 25){
    tick_count = 0;
    uint16_t mpptr = 0; // motion packet pointer 
    if(planner->do_set_position){
      motion_packet[mpptr ++] = UB_AK_SETPOS;
      planner->do_set_position = false;
    } else {
      motion_packet[mpptr ++] = UB_AK_GOTOPOS;
    }
    // XYZE 
    ts_writeFloat32(smoothieRoll->actuators[0]->floating_position, motion_packet, &mpptr);
    ts_writeFloat32(smoothieRoll->actuators[1]->floating_position, motion_packet, &mpptr);
    ts_writeFloat32(smoothieRoll->actuators[2]->floating_position, motion_packet, &mpptr);
    ts_writeFloat32(smoothieRoll->actuators[3]->floating_position, motion_packet, &mpptr);
    // write packet, put on ucbus
    //DEBUG3PIN_ON;
    ucBusHead->transmit_a(motion_packet, 21);
    //DEBUG3PIN_OFF;
  }
}

/*
case AK_GOTOPOS: {
        ptr ++; // walk mocode 
        reply[rl ++] = AK_GOTOPOS;
        // get positions 
        chunk_float32 targetChunks[3];
        targetChunks[0] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
        targetChunks[1] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
        targetChunks[2] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
        // get feed 
        chunk_float32 feedrateChunk = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
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
        if(ucBusHead->cts_b(12) && !smoothie_is_moving()){
          ptr ++;
          // same as currents, we can forward these posns', 
          //ucBusHead->transmit_b(&(data[ptr]), 13);
          // but also need to set our own position to this... 
          chunk_float32 setChunks[3];
          setChunks[0] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
          setChunks[1] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
          setChunks[2] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
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
        chunk_uint32 setChunk = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
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
      if(ucBusHead->cts_b(12)){
        // this is basically a forward, or should be, 
        // data[ptr] == AK_SETCURRENT, + 3*4 wide floats
        // we can actually do this direct from pck -> bus outbuffer 
        ucBusHead->transmit_b(&(data[ptr]), 13, 12);
        reply[rl ++] = AK_OK;
      } else {
        reply[rl ++] = AK_ERR;
        ts_writeString("ucbus b-channel not clear, cannot write currents", reply, &rl);
      }
      break;
    case AK_SETRPM:
      // spindle rpm change 
      reply[rl ++] = AK_SETRPM;
      if(ucBusHead->cts_b(12)){ // this is aaaaahn float, or uint32, either way: 
        ucBusHead->transmit_b(&(data[ptr]), 5, 12);
        reply[rl ++] = AK_OK;
      } else {
        reply[rl ++] = AK_ERR;
        ts_writeString("ucbus b-channel not clear, cannot write rpm", reply, &rl);
      }
      break;
    case AK_SET_TC: 
      // set motor torque downstream 
      reply[rl ++] = AK_SET_TC;
      if(ucBusHead->cts_b(12)){ // this is aaaaahn float, or uint32, either way: 
        ucBusHead->transmit_b(&(data[ptr]), 5, 12);
        reply[rl ++] = AK_OK;
      } else {
        reply[rl ++] = AK_ERR;
        ts_writeString("ucbus b-channel not clear, cannot write rpm", reply, &rl);
      }
      break;
    case AK_RUNCALIB:
      // set motor torque downstream 
      reply[rl ++] = AK_RUNCALIB;
      if(ucBusHead->cts_b(12)){ // this is aaaaahn float, or uint32, either way: 
        ucBusHead->transmit_b(&(data[ptr]), 5, 12);
        reply[rl ++] = AK_OK;
      } else {
        reply[rl ++] = AK_ERR;
        ts_writeString("ucbus b-channel not clear, cannot write rpm", reply, &rl);
      }
      break;
*/