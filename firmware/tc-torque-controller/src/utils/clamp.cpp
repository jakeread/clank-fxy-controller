#include "clamp.h"

void clamp(float *val, float min, float max){
    if(*val < min){
        *val = min;
    } else if (*val > max){
        *val = max;
    }
}