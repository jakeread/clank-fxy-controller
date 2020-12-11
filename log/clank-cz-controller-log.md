## 2020 11 11

Mostly, the delta here will be for toolchanging. Still leaning on GCode as a high level input.

Assembling this all together I encounter the same problems: cl-step controller was developed w/ a USB link, I want to put it on the bus. Probably need to tell it to calibrate itself via the bus as well.

I think those are CHB bus signals, as the CHA will still be doing motion stuff. 

- setup head to rx and forward AK_TC commands 
- setup button to 'tool hold' 'tool release' in the UI, forwarding thru
- rx that on the chb, see if motor twerks 

I am setting this all up pretty ad-hoc. Ideally, would be routing codes to the bus w/o changing any operation in the head. That should be my next big programming task... also, getting the closed loop steppers up and ready to do position control - I need to home them. 

Have that up and running, but have some poor performance down here - I wonder if the bus interrupt is interfering with the control interrupt. I could re-route the control to code to run w/o the timer. The troublesome performance might also be related to bad bus / channel B receipts. 

- instrument both interrupts, see if overlab 
- otherwise, have bus chb err 

Can confirm some interrupt / max micro resource allocation is going on: when I run this w/ the bus in-op, bad things. When I run it on USB alone (to communicate) it's all great. 

Yeah, these are definitely overlapping in an uncomfortable way. I wonder if I can set interrupt priorities or something like this. 

I can set those priorities, and I think I would have to keep the bus timing tight and decrease the control priority: the bus interrupts anyways are way shorter. But this should still work - the comm interrupt should execute and not interfere with the commutation code. Somehow, it seems to be interfering... as if the latter half does not tick.

Perhaps it's because I'm using this strange interrupt-chaining thing with the encoder reading. I can try some blocking code there. And, I hung the processor and am now having this slow bootloader issue. 

OK - reset the PC, fixes the bootloader lag. Figured the likely culprit was missed SPI interrupts on the RX, causing bad encoder readings. Set the UART priority to 1, SPI is default 0 (highest) and timers are 2, seems to work well now, learned a little about interrupts, rad. 

I think that's it for tonight then... other codes should be sorted already, just need to plumb it all out, and then write a small promise-chain JS thing to do the tool swap, will see. Knowing absolute position is a trick still, can't home... will manually load into back corners or something. 

## 2020 11 12

OK, have configs all running. Tool grip is huge, can probably turn the torque down a good deal... and my cable drive needs some work, loosened up under real load almost immediately, I suspect it was poorly seated guide tubes. 

OK, have the mechanical stuff together now, works on a manually controlled dry run. So I have some controller work to do, I think it's all JS though - unless I got my SPU wrong (likely). 

- js: add 'tool torque zero'
- js: reduce tool holding torque, or set hi to swing, then lo to hold. use lower clamping than releasing torque so things don't stick (?). 
- confirm SPU across machine 
- 'pickup' does 
    - go to tool-down position, -100x
    - go to tool-down position
    - await motion end 
    - grip tool torque
    - await 0.2s
    - hold tool torque 
    - come back to dool-down position -100x
- 'put down' does 
    - the same, reversed tool load posn 
    - maybe slow in-out 