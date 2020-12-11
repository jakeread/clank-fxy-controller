/*
utils/clocks_d51_module.h

clock utilities for the D51 as moduuularized, adhoc! 
i.e. xtals present on module board or otherwise 

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2019

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the squidworks and ponyo
projects. Copyright is retained and must be preserved. The work is provided as
is; no warranty is provided, and users accept all liability.
*/

#ifndef CLOCKS_D51_MODULE_H_
#define CLOCKS_D51_MODULE_H_

#include <Arduino.h>

#include "../drivers/indicators.h"

#define MHZ_XTAL_GCLK_NUM 9

class D51_Clock_Boss {
    private:
        static D51_Clock_Boss* instance;
    public:
        D51_Clock_Boss();
        static D51_Clock_Boss* getInstance(void);
        // xtal
        volatile boolean mhz_xtal_is_setup = false;
        uint32_t mhz_xtal_gclk_num = 9;
        void setup_16mhz_xtal(void);
        // builds 100kHz clock on TC0 or TC2
        // todo: tell these fns a frequency, 
        void start_100kHz_ticker_tc0(void); 
        void start_50kHz_ticker_tc0(void);
        void start_100kHz_ticker_tc2(void);
};

extern D51_Clock_Boss* d51_clock_boss;

#endif 