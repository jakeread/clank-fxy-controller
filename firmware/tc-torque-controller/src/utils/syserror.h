#ifndef SYSERROR_H_
#define SYSERROR_H_

#include <arduino.h>
#include "./drivers/indicators.h"
#include "./utils/cobs.h"
#include "./osap/ts.h"

void sysError(String msg);

#endif
