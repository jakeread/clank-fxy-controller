#include <Arduino.h>

#include "drivers/indicators.h"
#include "utils/cobs.h"
#include "osap/osap.h"

OSAP* osap = new OSAP("cl stepper motor drop");

#include "osap/vport_usbserial.h"
VPort_USBSerial* vPortSerial = new VPort_USBSerial();
#include "drivers/ucbus_drop.h"
#include "drivers/step_cl.h"

#include "utils/clocks_d51_module.h"

union chunk_float32 {
  uint8_t bytes[4];
  float f;
};

union chunk_float64 {
  uint8_t bytes[8];
  double f;
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

#define BUS_DROP 4    // Z: 1, YL: 2, X: 3, YR: 4
#define AXIS_PICK 2   // Z: 2, Y: 1, X: 0
#define AXIS_INVERT false  // Z: false, YL: true, YR: false, X: false
#define SPU 3200.0F // always positive! Z: 3200, XY: 400 
#define C_SCALE 0.2F // 0-1, floating: initial holding current to motor, 0-2.5A 
#define TICKS_PER_PACKET 20.0F // always 20.0F

void setup() {
  ERRLIGHT_SETUP;
  CLKLIGHT_SETUP;
  DEBUG1PIN_SETUP;
  // osap
  osap->description = "cl controller test";
  // serport 
  osap->addVPort(vPortSerial);
  // bus 
  ucBusDrop->init(false, BUS_DROP);
  // cl controller 
  step_cl->init();
  // start ctrl timer for 100khz loop, 
  d51_clock_boss->start_50kHz_ticker_tc0();
}

// 50kHz control tick 
void TC0_Handler(void){
  TC0->COUNT32.INTFLAG.bit.MC0 = 1;
  TC0->COUNT32.INTFLAG.bit.MC1 = 1;
  step_cl->run_torque_loop();
}

uint8_t bChPck[64];
volatile float current_floating_pos = 0.0F;
volatile int32_t current_step_pos = 0;
volatile uint32_t delta_steps = 0;
volatile float vel = 0.0F; 
volatile float move_counter = 0.0F;
volatile boolean setBlock = false;
uint16_t tick = 0;

// async loop 
void loop() {
  osap->loop();
  step_a4950->dacRefresh();
  // check chb packes 
  if(ucBusDrop->ctr_b()){
    uint16_t len = ucBusDrop->read_b(bChPck);
    uint16_t ptr = 0;
    switch(bChPck[ptr]){
      case AK_SET_TC: {
          ptr ++;
          chunk_float32 tcs = { .bytes = { bChPck[ptr ++], bChPck[ptr ++], bChPck[ptr ++], bChPck[ptr ++] }};
          step_cl->set_torque(tcs.f);
        }
        break;
      case AK_RUNCALIB:
        step_cl->calibrate();
        break;
      default:
        // noop 
        break;  
    }
  }
} // end loop 

// usb packets 
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
    case AK_RUNCALIB:
      ptr ++; // walk stepcode 
      reply[rl ++] = AK_RUNCALIB;
      if(step_cl->calibrate()){
        reply[rl ++] = AK_OK;
      } else {
        reply[rl ++] = AK_ERR;
      }
      // do step 
      break;
    case AK_READCALIB:
      ptr ++; // walk readcode
      reply[rl ++] = AK_READCALIB;
      step_cl->print_table(); 
      // do work 
      break;
    case AK_SET_TC: {
        ptr ++;
        reply[rl ++] = AK_SET_TC;
        chunk_float32 tcs = { .bytes = { pck[ptr ++], pck[ptr ++], pck[ptr ++], pck[ptr ++] }};
        step_cl->set_torque(tcs.f);
        float deg_sec = step_cl->get_deg_sec();
        ts_writeFloat32(deg_sec, reply, &rl);
        break;
      }
    default:
      break;
  }
  // end pck[ptr] switch 
  if(rl > 1){
    if(vp->cts()){
      appReply(pck, pl, replyPtr, segsize, vp, vpi, reply, rl);
    } else {
      sysError("on reply, not cts, system fails");
    }
  }
  // always clear this 
  vp->clearPacket(pwp);
}

// on words rx'd from bus, 
void UCBus_Drop::onRxISR(void){

}

// on timed (interrupt) rx of bus packet, channel A 
// this is where we will eventually read-in positions, and target them
void UCBus_Drop::onPacketARx(void){
  
}

