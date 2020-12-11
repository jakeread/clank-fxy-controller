/*
osap/drivers/step_cl.cpp

stepper in closed loop mode 

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the squidworks and ponyo
projects. Copyright is retained and must be preserved. The work is provided as
is; no warranty is provided, and users accept all liability.
*/

#include "step_cl.h"
#include "../utils/FlashStorage.h"
#include "../utils/clamp.h"

Step_CL* Step_CL::instance = 0;

Step_CL* Step_CL::getInstance(void){
    if(instance == 0){
        instance = new Step_CL();
    }
    return instance;
}

Step_CL* step_cl = Step_CL::getInstance();

Step_CL::Step_CL(void){}

#define CALIB_CSCALE 0.4F
#define CALIB_STEP_DELAY 10
#define CALIB_SETTLE_DELAY 1
#define CALIB_SAMPLE_PER_TICK 10 

#define ENCODER_COUNTS 16384

void Step_CL::init(void){
    step_a4950->init(false, 0.4);
    enc_as5047->init();
    _tc = 0; // torque command -> 0; 
    is_calibrating = false;
}

// LUT / flash work 
/*
the D51J19 flash is organized into *pages* of 512bytes, 
and *blocks* of 16 pages (8192 bytes)
write granularity is to the page, erase granularity is per block 
we must erase flash before writing to it: this is how flash hardware works 
to do flash storage of this monster table, we declare a const LUT array
const keyword will cause the compiler to put it in flash mem, 
and so we point the helper class at that void* (the head of the array) to start, 
and increment that void* thru the array in blocks, when our buffer is full
*/

#define BYTES_PER_BLOCK 8192
#define FLOATS_PER_BLOCK 2048

const float __attribute__((__aligned__(8192))) lut[32768] = {}; // the actual LUT: const means it gets allocated to flash 
FlashClass flashClass((const uint8_t*)lut); // helper class (lib) // https://github.com/cmaglie/FlashStorage
const void* block_ptr; // void* to section-of-lut for write 
static float buffer[FLOATS_PER_BLOCK]; // one full block (16 pages) of flash mem, buffered 

uint32_t bfi = 0; // buffer indice 
uint32_t bli = 0; // block indice 

void flash_write_init(void){
    block_ptr = (const uint8_t*) lut;
    bfi = 0;
    bli = 0;
}

void flash_write_page(void){
    //sysError("erasing 0x" + String((uint32_t)block_ptr));
    flashClass.erase(block_ptr, BYTES_PER_BLOCK);
    //sysError("writing 0x" + String((uint32_t)block_ptr));
    flashClass.write(block_ptr, (const uint8_t*)buffer, BYTES_PER_BLOCK);
    delay(1);
}

void flash_write_value(float val){
    buffer[bfi ++] = val;
    if(bfi >= FLOATS_PER_BLOCK){
        flash_write_page();
        bfi = 0;
        bli ++;
        block_ptr = ((const uint8_t *)(&(lut[bli * FLOATS_PER_BLOCK]))); 
    }
}

void Step_CL::print_table(void){
    sysError("reading from lut");
    for(uint32_t i = 0; i < ENCODER_COUNTS; i ++){
        float ra = lut[i * 2];
        float pa = lut[i * 2 + 1];
        sysError("real angle at enc " + String(i) + ": " + String(ra) + "phase angle: " + String(pa));
        delay(5);
    }
}

// set twerks 
// tc: -1 : 1
void Step_CL::set_torque(float tc){
    clamp(&tc, -1.0F, 1.0F);
    _tc = tc;
}

float Step_CL::get_torque(void){
    return _tc;
}

// the control loop 
void Step_CL::run_torque_loop(void){
    if(is_calibrating) return;
    // mark time 
    //DEBUG1PIN_ON;
    // ok, first we read the encoder 
    enc_as5047->trigger_read();
    // this kicks off the party, proceeds below
}

#define MAP_7p2_TO_1 (1.0F / 7.2F)
#define TICKS_PER_SEC 50000.0F
#define SECS_PER_TICK 1.0F / TICKS_PER_SEC
volatile float q = 0.05F;//0.125F;      // process noise covariance  
volatile float r = 1.0F;        // measurement noise covariance 
volatile float measurement;     // the measurement... 
volatile float a = 0.0F;        // the estimate on a 
volatile float p = 100.0F;        // estimation error covariance 
volatile float k;               // kalman gain 

volatile float _deg_s;      // real angle / sec 
volatile float _pa;         // phase angle 

float Step_CL::get_deg_sec(void){
    return _deg_s;
}

void ENC_AS5047::on_read_complete(uint16_t result){
    if(step_cl->is_calibrating) return;
    /*
    // (1) get the new measurement,
    measurement = lut[result * 2]; 

    p = p + q;

    k = p / (p + r);
    a = a + k * (measurement - a);
    p = (1 - k) * p;

    // write a 'real' speed value 
    _deg_s = measurement;
    */

    _pa = lut[result * 2 + 1];      // the phase angle (0 - 1 in a sweep of 4 steps)
    // this is the phase angle we want to apply, 90 degs off & wrap't to 1 
    if(step_cl->get_torque() < 0){
        _pa -= 0.25; // 90* phase swop 
        if(_pa < 0){
            _pa += 1.0F;
        }
    } else {
        _pa += 0.25;
        if(_pa > 1){
            _pa -= 1.0F;
        }
    }
    // now we ask our voltage modulation machine to put this on the coils 
    // with the *amount* commanded by our _tc torque ask 
    step_a4950->point(_pa, abs(step_cl->get_torque()));
    // debug loop completion 
}

// the calib routine 
boolean Step_CL::calibrate(void){
    is_calibrating = true;
    delay(1);
    // (1) first, build a table for 200 full steps w/ encoder averaged values at each step 
    float phase_angle = 0.0F;
    for(uint8_t i = 0; i < 200; i ++){ 
        // pt to new angle 
        step_a4950->point(phase_angle, CALIB_CSCALE);
        // wait to settle / go slowly 
        delay(CALIB_STEP_DELAY);
        // do readings 
        float x = 0.0F;
        float y = 0.0F;
        for(uint8_t s = 0; s < CALIB_SAMPLE_PER_TICK; s ++){
            enc_as5047->trigger_read();
            while(!enc_as5047->is_read_complete()); // do this synchronously 
            float reading = enc_as5047->get_reading();
            x += cos((reading / (float)(ENCODER_COUNTS)) * 2 * PI);
            y += sin((reading / (float)(ENCODER_COUNTS)) * 2 * PI);
            // this is odd, I know, but it allows a new measurement to settle
            // so we get a real average 
            delay(CALIB_SETTLE_DELAY); 
        }
        // push reading, average removes the wraps added to readings. 
        calib_readings[i] = atan2(y, x);//(reading / (float)CALIB_SAMPLE_PER_TICK) - ENCODER_COUNTS;
        if(calib_readings[i] < 0) calib_readings[i] = 2 * PI + calib_readings[i]; // wrap the circle 
        calib_readings[i] = (calib_readings[i] * ENCODER_COUNTS) / (2 * PI);
        // rotate 
        phase_angle += 0.25F;
        if(phase_angle >= 1.0F) phase_angle = 0.0F;
    } // end measurement taking 
    // tack end-wrap together, to easily find the wrap-at-indice interval 
    calib_readings[200] = calib_readings[0];
    if(false){ // debug print intervals 
        for(uint8_t i = 0; i < 200; i ++){
            sysError("int: " + String(i) 
                        + " " + String(calib_readings[i], 4)
                        + " " + String(calib_readings[i + 1], 4));
            delay(2);
        }
    }
    // check sign of readings 
    // the sign will help identify the wrapping interval
    // might get unlucky and find the wrap, so take majority vote of three 
    boolean s1 = (calib_readings[1] - calib_readings[0]) > 0 ? true : false;
    boolean s2 = (calib_readings[2] - calib_readings[1]) > 0 ? true : false;
    boolean s3 = (calib_readings[3] - calib_readings[2]) > 0 ? true : false;
    boolean sign = false;
    if((s1 && s2) || (s2 && s3) || (s1 && s3)){
        sign = true;
    } else {
        sign = false;
    }
    sysError("calib sign: " + String(sign));

    // (2) build the table, walk all encoder counts... 
    // now to build the actual table... 
    // want to start with the 0 indice, 
    flash_write_init();
    for(uint16_t e = 0; e < ENCODER_COUNTS; e ++){
        // find the interval that spans this sample
        boolean bi = false; 
        int16_t interval = -1;
        for(uint8_t i = 0; i < 200; i ++){
            if(sign){ // +ve slope readings, left < right 
                if(calib_readings[i] < e && e <= calib_readings[i + 1]){
                    interval = i;
                    break;
                }
            } else { // -ve slope readings, left > right 
                if(calib_readings[i] > e && e >= calib_readings[i + 1]){
                    interval = i;
                    break;
                }
            }
        }
        // log intervals 
        if(interval >= 0){
            // sysError(String(e) + " inter: " + String(interval) 
            //                 + " " + String(calib_readings[interval]) 
            //                 + " " + String(calib_readings[interval + 1]));
        } else {
            // no proper interval found, must be the bi 
            // find the opposite-sign interval 
            for(uint8_t i = 0; i < 200; i ++){
                boolean intSign = (calib_readings[i + 1] - calib_readings[i]) > 0 ? true : false;
                if(intSign != sign){
                    interval = i;
                    bi = true; // mark the bad interval
                    break;
                }
            }
            if(!bi){
                // truly strange 
                sysError("missing interval, exiting");
                return false;
            }
            /*
            sysError("bad interval at: " + String(e) 
                    + " " + String(interval)
                    + " " + String(calib_readings[interval]) 
                    + " " + String(calib_readings[interval + 1]));
            */
        }

        // (3) have the interval (one is bad), 
        // find real angles (ra0, ra1)
        float ra0 = 360.0F * ((float)interval / 200);          // real angle at left of interval 
        float ra1 = 360.0F * ((float)(interval + 1) / 200);    // real angle at right of interval 
        // interval spans these readings (er0, er1)
        float er0 = calib_readings[interval];
        float er1 = calib_readings[interval + 1];

        // (4) for the bad interval, some more work to do to modify interp. points 
        float spot = e;
        if(bi){
            if(sign){ // wrap the tail *up*, do same for pts past zero crossing 
                er1 += (float)ENCODER_COUNTS;
                if(spot < er0) spot += (float)ENCODER_COUNTS;
            } else { // wrap the tail *down*, do same for pts past zero crossing 
                er1 -= (float)ENCODER_COUNTS;
                if(spot > er0) spot -= (float)ENCODER_COUNTS;
            }
        }

        // (5) continue w/ (ra0, ra1) and (er0, er1) to interpolate for spot 
        // check we are not abt to div / 0: this could happen if motor did not turn during measurement 
        float intSpan = er1 - er0;
        if(intSpan < 0.01F && intSpan > -0.01F){
            sysError("near zero interval, exiting");
            return false;
        }
        // find pos. inside of interval 
        float offset = (spot - er0) / intSpan;
        // find real angle offset at e, modulo for the bad interval 
        float ra = (ra0 + (ra1 - ra0) * offset);
        // log those 
        if(false){
            if(bi){
                sysError("e: " + String(e) + " ra: " + String(ra, 4) + " BI");
                //     + " span: " + String(intSpan) + " offset: " + String(offset));
                // sysError("i0: " + String(interval) + " " + String(calib_readings[interval])
                //     + " i1: " + String(calib_readings[interval + 1])
                //     + " BI");
            } else {
                sysError("e: " + String(e) + " ra: " + String(ra, 4));
            }
            delay(10);            
        }
        // ok, have the real angle (ra) at the encoder tick (e), now write it 
        flash_write_value(ra); // log the real angle here 
        float pa = ra;
        while(pa > 7.2F){
            pa -= 7.2F;
        }
        pa = pa * MAP_7p2_TO_1;
        flash_write_value(pa); // log the phase angle beside it 
    } // end sweep thru 2^14 pts 
    sysError("calib complete");
    is_calibrating = false;
    return true; // went OK 
}

