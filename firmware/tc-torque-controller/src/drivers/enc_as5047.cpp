/*
osap/drivers/enc_as5047.cpp

reads an as5047x on SER4

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2019

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the squidworks and ponyo
projects. Copyright is retained and must be preserved. The work is provided as
is; no warranty is provided, and users accept all liability.
*/

#include "enc_as5047.h"
#include "../utils/clocks_d51_module.h"

ENC_AS5047* ENC_AS5047::instance = 0;

ENC_AS5047* ENC_AS5047::getInstance(void){
    if(instance == 0){
        instance = new ENC_AS5047();
    }
    return instance;
}

ENC_AS5047* enc_as5047 = ENC_AS5047::getInstance();

ENC_AS5047::ENC_AS5047(){};

void ENC_AS5047::init(void){
    // do pin setup 
    // chip select (not on PC, op manuel)
    ENC_CS_PORT.DIRSET.reg = ENC_CS_BM;
    ENC_CS_DESELECT;
    // clk 
    ENC_CLK_PORT.DIRSET.reg = ENC_CLK_BM;
    ENC_CLK_PORT.PINCFG[ENC_CLK_PIN].bit.PMUXEN = 1;
    if(ENC_CLK_PIN % 2){
        ENC_CLK_PORT.PMUX[ENC_CLK_PIN >> 1].reg |= PORT_PMUX_PMUXO(ENC_SER_PERIPHERAL);
    } else {
        ENC_CLK_PORT.PMUX[ENC_CLK_PIN >> 1].reg |= PORT_PMUX_PMUXE(ENC_SER_PERIPHERAL);
    }
    // mosi
    ENC_MOSI_PORT.DIRSET.reg = ENC_MOSI_BM;
    ENC_MOSI_PORT.PINCFG[ENC_MOSI_PIN].bit.PMUXEN = 1;
    if(ENC_MOSI_PIN % 2){
        ENC_MOSI_PORT.PMUX[ENC_MOSI_PIN >> 1].reg |= PORT_PMUX_PMUXO(ENC_SER_PERIPHERAL);
    } else {
        ENC_MOSI_PORT.PMUX[ENC_MOSI_PIN >> 1].reg |= PORT_PMUX_PMUXE(ENC_SER_PERIPHERAL);
    }
    // miso 
    ENC_MISO_PORT.DIRCLR.reg = ENC_MISO_BM;
    ENC_MISO_PORT.PINCFG[ENC_MISO_PIN].bit.PMUXEN = 1;
    if(ENC_MISO_PIN % 2){
        ENC_MISO_PORT.PMUX[ENC_MISO_PIN >> 1].reg |= PORT_PMUX_PMUXO(ENC_SER_PERIPHERAL);
    } else {
        ENC_MISO_PORT.PMUX[ENC_MISO_PIN >> 1].reg |= PORT_PMUX_PMUXE(ENC_SER_PERIPHERAL);
    }

    // do SPI clock setup
    MCLK->APBDMASK.bit.SERCOM4_ = 1;
    GCLK->GENCTRL[ENC_SER_GCLKNUM].reg = GCLK_GENCTRL_SRC(GCLK_GENCTRL_SRC_DFLL) | GCLK_GENCTRL_GENEN;
    while(GCLK->SYNCBUSY.reg & GCLK_SYNCBUSY_GENCTRL(ENC_SER_GCLKNUM));
    GCLK->PCHCTRL[ENC_SER_GCLK_ID_CORE].reg = GCLK_PCHCTRL_CHEN | GCLK_PCHCTRL_GEN(ENC_SER_GCLKNUM);
    
    // reset / disable SPI 
    while(ENC_SER_SPI.SYNCBUSY.bit.ENABLE);
    ENC_SER_SPI.CTRLA.bit.ENABLE = 0; // disable 
    while(ENC_SER_SPI.SYNCBUSY.bit.SWRST);
    ENC_SER_SPI.CTRLA.bit.SWRST = 1; // reset 
    while(ENC_SER_SPI.SYNCBUSY.bit.SWRST || ENC_SER_SPI.SYNCBUSY.bit.ENABLE);
    
    // configure the SPI 
    // AS5047 datasheet says CPOL = 1, CPHA = 0, msb first, and parity checks 
    // bit: func 
    // 15: parity, 14: 0/read, 1/write, 13:0 address to read or write 
    ENC_SER_SPI.CTRLA.reg = //SERCOM_SPI_CTRLA_CPOL | // CPOL = 1
                            SERCOM_SPI_CTRLA_CPHA | // ?
                            SERCOM_SPI_CTRLA_DIPO(3) | // pad 3 is data input 
                            SERCOM_SPI_CTRLA_DOPO(0) | // pad 0 is data output, 1 is clk  
                            SERCOM_SPI_CTRLA_MODE(3);  // mode 3: head operation 
    ENC_SER_SPI.CTRLB.reg = SERCOM_SPI_CTRLB_RXEN; // enable rx, char size is 8, etc 
    ENC_SER_SPI.BAUD.reg = SERCOM_SPI_BAUD_BAUD(2); // f_baud = f_ref / ((2*BAUD) + 1) 
                                                    // BAUD = 2 ~= 8MHz / 124ns clock period 
                                                    // BAUD = 3 ~= 6MHz / 164ns clock period: AS5047 min period is 100ns
    
    // enable interrupts 
    NVIC_EnableIRQ(SERCOM4_1_IRQn);
    NVIC_EnableIRQ(SERCOM4_2_IRQn);
    // turn it back on 
    while(ENC_SER_SPI.SYNCBUSY.bit.ENABLE);
    ENC_SER_SPI.CTRLA.bit.ENABLE = 1;
    // just... always listen 
    ENC_SER_SPI.INTENSET.bit.RXC = 1;
}

void ENC_AS5047::start_spi_interaction(uint16_t outWord){
    // for some reason, have to reset this to fire? 
    ENC_SER_SPI.INTENSET.bit.RXC = 1;
    if(ENC_SER_SPI.INTFLAG.bit.DRE == 1){
        ENC_CS_SELECT;
        // write first half (back 8 bits) then enable tx interrupt to write second 
        // when written & cleared, write next half 
        outWord01 = (outWord >> 8);
        outWord02 = outWord & 255;
        firstWord = true;
        ENC_SER_SPI.DATA.reg = outWord01;
        ENC_SER_SPI.INTENSET.bit.TXC = 1;
    }
}

void ENC_AS5047::txcISR(void){
    // always clear this flag 
    ENC_SER_SPI.INTFLAG.bit.TXC = 1;
    if(firstWord){
        ENC_SER_SPI.DATA.reg = outWord02;
        firstWord = false;
    } else {
        ENC_SER_SPI.INTENCLR.bit.TXC = 1;
        if(firstAction){
            firstAction = false;
            ENC_CS_DESELECT;
            start_spi_interaction(AS5047_SPI_READ_POS);
        }
    }
}

void ENC_AS5047::rxcISR(void){
    // always clear the bit, 
    uint8_t data = ENC_SER_SPI.DATA.reg;
    readComplete = true;
    if(!firstAction){
        if(firstWord){
            inWord01 = data;
        } else {
            inWord02 = data;
            result = 0b0011111111111111 & ((inWord01 << 8) | inWord02);
            ENC_CS_DESELECT;
            on_read_complete(result);
            readComplete = true;
        }
    }
}

void SERCOM4_2_Handler(void){
    enc_as5047->rxcISR();
}

// 1 handles TXC 
void SERCOM4_1_Handler(void){
    enc_as5047->txcISR();
}

void ENC_AS5047::trigger_read(void){
    firstAction = true;
    readComplete = false;
    start_spi_interaction(AS5047_SPI_READ_POS);
}

boolean ENC_AS5047::is_read_complete(void){
    return readComplete;
}

uint16_t ENC_AS5047::get_reading(void){
    return result;
}