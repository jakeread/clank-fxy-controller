/*
osap/drivers/step_cl.h

stepper in closed loop mode 

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the squidworks and ponyo
projects. Copyright is retained and must be preserved. The work is provided as
is; no warranty is provided, and users accept all liability.
*/

#ifndef STEP_CL_H_
#define STEP_CL_H_ 

#include <Arduino.h>

#include "step_a4950.h"
#include "enc_as5047.h"

class Step_CL {
    private:
        static Step_CL* instance;
        float calib_readings[201];
        volatile float _tc;

    public:
        Step_CL();
        static Step_CL* getInstance(void);
        void init(void);
        void print_table(void);
        void set_torque(float tc);
        float get_torque(void);
        float get_deg_sec(void);
        void run_torque_loop(void);
        boolean calibrate(void);
        boolean is_calibrating;
        //float __attribute__((__aligned__(256))) lut[16384]; // nor does this ! 
        //float lut[16384]; // nor does this work 
        //step_cl_calib_table_t lut; // not even this works ?? too big ?? 
};

extern const float lut[];

extern Step_CL* step_cl;

#endif 