/*

motor.h

driver interface hack for smoothie port 

*/

#ifndef STEPINTERFACE_H_
#define STEPINTERFACE_H_

#include <Arduino.h>

class StepInterface {
    public:
        StepInterface(void);

        int32_t steps_to_target(float target);
        void update_last_milestones(float mm, int32_t steps);
        void set_position(float mm);
        float get_last_milestone_mm(void);

        boolean step(void);
        void set_direction(boolean dir);
        void start_moving(void);
        void stop_moving(void);
        boolean is_moving(void);
        // could also use this structure to setup steps / mm, max accel, max rate per actuator 

        // for net interface, 
        volatile int32_t stepwise_position = 0;
        volatile float floating_position = 0.0F;

    private:
        volatile boolean direction = false;
        volatile boolean moving = false;

        float steps_per_mm = 400.0F; // for everyone: this is a hack... actually we send floating posns to steppers, who deal with this config 
        float mm_per_step = 1 / steps_per_mm;
        int32_t last_milestone_steps = 0;
        float last_milestone_mm = 0;
};

#endif 