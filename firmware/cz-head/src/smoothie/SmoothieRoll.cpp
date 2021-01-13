/*
SmoothieRoll.cpp

bottle & state container for the SmoothieWare instance running here

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2019

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the osap project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

#include "SmoothieRoll.h"

SmoothieRoll* SmoothieRoll::instance = 0;

SmoothieRoll* SmoothieRoll::getInstance(void){
    if(instance == 0){
        instance = new SmoothieRoll();
    }
    return instance;
}

SmoothieRoll* smoothieRoll = SmoothieRoll::getInstance();

SmoothieRoll::SmoothieRoll(void){
    
}

void SmoothieRoll::init(void){
    // make motors 
    for(uint8_t m = 0; m < SMOOTHIEROLL_NUM_MOTORS; m ++){
        actuators[m] = new StepInterface();
    }
    stepTicker->init();
    stepTicker->start();
    conveyor->on_module_loaded();
    conveyor->start(3);
}

void SmoothieRoll::step_tick(void){
    stepTicker->step_tick();
}