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
    case AK_BUSECHO: { // debug bus forward 
        if(ucBusHead->cts_b(12)){
          sysError("transmit " + String(pl-ptr-1));
          ucBusHead->transmit_b(&(pck[ptr + 1]), pl - ptr - 1, 12);
        } else {
          sysError("bus not cts");
        }
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
  vp->clear(pwp);
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
  osap->addVPort(vPortUcBusHead);
  // smoothie 
  smoothieRoll->init();
  // 100kHz base (10us period)
  d51_clock_boss->start_ticker_a(10);
}

// runs as often as possible, 

void loop() {
  //DEBUG2PIN_TOGGLE;
  osap->loop();
  conveyor->on_idle(nullptr);
  // receive the bus 
  if(ucBusHead->ctr(12)){
    size_t returnLen = ucBusHead->read(12, testReturnPacket);
    sysError("return " + String(returnLen));
    rl = 0;
    reply[rl ++] = DK_APP;
    reply[rl ++] = AK_BUSECHO;
    for(uint8_t i = 0; i < returnLen; i ++){
      reply[rl ++] = testReturnPacket[i];
    }
    osap->appReply(replyBlankPck, replyBlankPl, replyBlankPtr, replyBlankSegsize,
     replyBlankVp, replyBlankVpi, reply, rl);
  }
} // end loop 

// runs on period defined by timer_a setup: 
volatile uint8_t tick_count = 0;
uint8_t motion_packet[64]; // three floats bb, space 

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
    // dummy E / L value, 
    ts_writeFloat32(0.025, motion_packet, &mpptr);
    // write packet, put on ucbus
    //DEBUG3PIN_ON;
    ucBusHead->transmit_a(motion_packet, 17);
    //DEBUG3PIN_OFF;
  }
}