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
        || smoothieRoll->actuators[3]->is_moving()
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

// ENDPOINT 0 
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

// ENDPOINT 1
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

// ENDPOINT 2
boolean onPositionData(uint8_t* data, uint16_t len){
  // only if it's not moving, 
  if(smoothie_is_moving()){
    return false;
  } else {
    uint16_t ptr = 0;
    chunk_float32 targetChunks[4];
    targetChunks[0] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
    targetChunks[1] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
    targetChunks[2] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
    targetChunks[3] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
    // 
    float set[4] = { targetChunks[0].f, targetChunks[1].f, targetChunks[2].f, targetChunks[3].f };
    // ...
    planner->set_position(set, 4);
    return true;
  }
}
Endpoint* posEP = osap->endpoint(onPositionData);

// ENDPOINT 3
boolean onMotionEP(uint8_t* data, uint16_t len){
  // this is also just a query for the time being ... clear it, 
  return true;
}
Endpoint* motionEP = osap->endpoint(onMotionEP);

// ENDPOINT 4 
boolean onWaitTimeEP(uint8_t* data, uint16_t len){
  // writes a wait time for the queue: handy to shorten this up for jogging 
  uint32_t ms;
  uint16_t ptr = 0;
  ts_readUint32(&ms, data, &ptr);
  conveyor->setWaitTime(ms);
  return true;
}
Endpoint* waitTimeEP = osap->endpoint(onWaitTimeEP);

// ENDPOINT 5
boolean onAccelsEP(uint8_t* data, uint16_t len){
  // should be 4 floats: new accel values per-axis 
  uint16_t ptr = 0;
  chunk_float32 targetChunks[4];
  targetChunks[0] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
  targetChunks[1] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
  targetChunks[2] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
  targetChunks[3] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
  // they're in here 
  for(uint8_t m = 0; m < SR_NUM_MOTORS; m ++){
    smoothieRoll->actuators[m]->set_accel(targetChunks[m].f);
  }
  // assuming that went well, 
  return true;
}
Endpoint* accelSettingEP = osap->endpoint(onAccelsEP);

// ENDPOINT 6
boolean onRatesEP(uint8_t* data, uint16_t len){
  // should be 4 floats: new accel values per-axis 
  uint16_t ptr = 0;
  chunk_float32 targetChunks[4];
  targetChunks[0] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
  targetChunks[1] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
  targetChunks[2] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
  targetChunks[3] = { .bytes = { data[ptr ++], data[ptr ++], data[ptr ++], data[ptr ++] } };
  // they're in here 
  for(uint8_t m = 0; m < SR_NUM_MOTORS; m ++){
    smoothieRoll->actuators[m]->set_max_rate(targetChunks[m].f);
  }
  // assuming that went well, 
  return true;
}
Endpoint* rateSettingEP = osap->endpoint(onRatesEP);

// ENDPOINT 7
boolean onSpeedPut(uint8_t* data, uint16_t len);
boolean onSpeedQuery(void);

Endpoint* speedQueryEP = osap->endpoint(onSpeedPut, onSpeedQuery);

boolean onSpeedPut(uint8_t* data, uint16_t len){
  return true;
}

boolean onSpeedQuery(void){
  // collect actuator speeds, 
  uint8_t speedData[16];
  uint16_t wptr = 0;
  ts_writeFloat32(smoothieRoll->actuators[0]->current_speed, speedData, &wptr);
  ts_writeFloat32(smoothieRoll->actuators[1]->current_speed, speedData, &wptr);
  ts_writeFloat32(smoothieRoll->actuators[2]->current_speed, speedData, &wptr);
  ts_writeFloat32(smoothieRoll->actuators[3]->current_speed, speedData, &wptr);
  speedQueryEP->write(speedData, 16);
  return true;
}

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
  // 25kHz base (40us period)
  d51_clock_boss->start_ticker_a(40);
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
    // and write motion:
    uint8_t motion;
    if(smoothieRoll->actuators[0]->is_moving() || smoothieRoll->actuators[1]->is_moving() || smoothieRoll->actuators[2]->is_moving()){
      motion = true;
    } else {
      motion = false;
    }
    motionEP->write(&motion, 1);
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
    ucBusHead->transmit_a(motion_packet, 17);
    //DEBUG3PIN_OFF;
  }
}
