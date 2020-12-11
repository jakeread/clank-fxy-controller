/*
osap/drivers/enc_as5047.h

reads an as5047x on SER4

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2019

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the squidworks and ponyo
projects. Copyright is retained and must be preserved. The work is provided as
is; no warranty is provided, and users accept all liability.
*/

#ifndef ENC_AS5047_H_
#define ENC_AS5047_H_

#include <Arduino.h>

#include "indicators.h"
#include "utils/syserror.h"

#define ENC_CS_PIN 14   // PB14, SER4-2
#define ENC_CS_BM (uint32_t)(1 << ENC_CS_PIN)
#define ENC_CS_PORT PORT->Group[1]
#define ENC_CS_DESELECT ENC_CS_PORT.OUTSET.reg = ENC_CS_BM
#define ENC_CS_SELECT ENC_CS_PORT.OUTCLR.reg = ENC_CS_BM 
#define ENC_CLK_PIN 13  // PB13, SER4-1
#define ENC_CLK_BM (uint32_t)(1 << ENC_CLK_PIN)
#define ENC_CLK_PORT PORT->Group[1]
#define ENC_MOSI_PIN 12 // PB12, SER4-0 
#define ENC_MOSI_BM (uint32_t)(1 << ENC_MOSI_PIN)
#define ENC_MOSI_PORT PORT->Group[1]
#define ENC_MISO_PIN 15 // PB15, SER4-3 
#define ENC_MISO_BM (uint32_t)(1 << ENC_MISO_PIN)
#define ENC_MISO_PORT PORT->Group[1]

#define ENC_SER_SPI SERCOM4->SPI // on Peripheral C
#define ENC_SER_PERIPHERAL 2
#define ENC_SER_GCLK_ID_CORE SERCOM4_GCLK_ID_CORE 

#define ENC_SER_GCLKNUM 8

#define AS5047_SPI_READ_POS (0b1100000000000000 | 0x3FFF)
#define AS5047_SPI_NO_OP (0b1000000000000000)

class ENC_AS5047 {
    private:
        // is singleton
        static ENC_AS5047* instance;
        volatile uint8_t outWord01;
        volatile uint8_t outWord02;
        volatile uint8_t inWord01;
        volatile uint8_t inWord02;
        volatile uint16_t result;
        volatile boolean firstWord = false;
        volatile boolean firstAction = false;
        volatile boolean readComplete = true;
        void start_spi_interaction(uint16_t outWord);

    public:
        ENC_AS5047();
        static ENC_AS5047* getInstance(void);
        // isr 
        void txcISR(void);
        void rxcISR(void);
        // api 
        void init(void);
        void trigger_read(void); 
        boolean is_read_complete(void);
        uint16_t get_reading(void);
        void on_read_complete(uint16_t pos);
};

extern ENC_AS5047* enc_as5047;

#endif 