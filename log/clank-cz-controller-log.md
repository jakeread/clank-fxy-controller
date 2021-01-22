## Known Issues

- notes in 'virtualMachine.js' on promise timeouts 
- try i.e. sending a 'setcurrent' command while motion is ongoing... seems like some hangup is going on, but should be able to parallelize those 
- the PWM/5V/GND label on the esc board is backwards 
- setcurrent & other (?) ucbus chb transmissions appear to drop the last byte, or something like this - so i.e. remote z current resetting doesn't work 

### Clank CZ New Controller 

- change gcode parsing system: maybe delete these js modules, instead do direct vm call / which returns the osap.write() ? or so, idk how you want to do this 
- gcode delivery: need to change the timeout scale here to await those long acks for potentially lengthy gcodes... 

### Thursday 

- get extruder moves out of the smoothie roll 
  - rebuild stepper fw with osape submodule,
  - rebuild to consume E moves 
  - make smoothie roll well-separated piece of motion control kit / submodule
  - manipulate smoothie to pull extruder-actual-posn out (relative / absolute?)
  - push that on yonder net,
  - find your net spreadsheet, how many ticks / sec can do this?

### Friday

- setup your machine:
  - sync osape, pull to stepper code, 
  - step codes on YL, YR, Z, X, E, configurate 
  - network sweep / check things appear as they should, 
- test this gcode, 
  - why the long hang?
  - if long hangs are needed, implement some endpoint door-knocking: are you still home? another layer of timeouts... this is a way to not-miss acks as well, maybe a good thing to have 
- start heater dev: 
  - PID endpoints, 
  - query to plot temp, 
  - run PID in JS first (?)
    - 'loop' 100ms, 
    - timeout on embedded side: if no action in 500ms, turn 'em off 

### Saturday

- wrap it up: make hotend flow plastic, see about laying some tracks... 

### Sunday

- that's it ? you can run printer codes now? fix your UI for long gcodes, 
  - try a longer print, with a big nozzle for a more-even bed 
  - secure the demo 
- now, do the loadcell code, to read,
- now, run some demo code & record (via query) times / temps / loadcell loads at some hz / maybe 100 (?) if possible. network / flow control will be stressed, bueno. use recording to draw data in heatmap of when-extruder-load-was-highest 

### Extruder Motion Check

- likely breaks on e-only moves... test, check, avoid i.e. zero unit vector 

## 2021 01 22 

Have today, tomorrow, sunday, to wrap this up. 

Motion control feels exceptionally buggy at the moment, so today should mostly be about ironing that out. 

Oy,
- query position to interrogate motion control
- this demo motor doesn't show up on the graph ? circuit busted ? 
  - more likely, not enough space on the bus ? 

Yeah I'm trying to sidestep extruder stuff but I need to engage with it. Smoothie dealt with it in some offline manner... i.e. not coupled to the 'target' motion. Instead of trying to hack something, it is time that I engage with this properly. 

- revert to clank-cz controller smoothieroll, check x motor runs properly here 
- ok, now I should try adding the new move on the A channel transmit, try a steady stream... make sure this still works 
- this look ok as well, 
- query position & debug / draw 
- ok, that's fine... 

I think it's time to try to understand smoothie's guts and, hopefully, tack on those E moves... so... :/ 

- have NUM_MOTORS (4) and NUM_MOTION_AXIS (3) 
- build w/ this count of step interfaces, but don't change anything else... test 
- observe how blocks are built (?) and add stepper ticks (?) 

Working through it... 

## 2021 01 21 

- button opens closes
- recognize / toss gcode moves from ahn printer 
    - feedrate: smoothie will consume mm/sec, these are mm/min ? convert?
    - 'once' through, recognizing or tossing... 
    - smoothieroll: listens to extruder calls? how to interface smoothieroll in?
    - smoothieroll: how to get extruder calls out? time on CHA ? 

I'm wanting to write a decent interface to the gcode module. I am reluctant to continue using what I have here but I think it's actually kind of decent, so I will avoid re-writing... a halfway solution to these is no fun, I need to do it full on / the action I anticipate. 

OK, have furnished some things in the gcode module, I think I need to get back to the machine and jog it around now, get myself into extruder moves, and then I'll be into temps. 

- dipswitch count 'em, reload stepper firmware 
- try steps w/ XYZ ... jog ? 
- run mocontrol... on g28, demo lifts z ? 

I think I will be able to get away with sticking an E term in here pretty unceremoniously, to my smoothieroll. 

Eh, nope, a naive approach seems to hang it up... the whole kit isn't *that* huge though, I should be able to piece this together.

Fixed for now, another hack, still don't have a great handle on the code, although it isn't so overwhelming and with some decent treatment I should be able to really wrestle it into doing what I'd like.

In any case, the issue now is with timeouts... i.e. I need to wait longer for 'yacks' from the planner than normal. The quick hack would be just setting a wicked long timeout for this endpoint, the more robust (or, maybe just more complex) thing to do would be to instrument an 'endpoint check' datagram, that effectively knocks on the door every once and a while to make sure the data line is not severed or anything. 

I think there are still some motion bugs, this shouldn't hang more than 100s, where I've sloppily set the timeout to. So, tomorrow I'll wire up motors and should be able to get a better sense of what's going on with that... probably some more smoothie diving to do inside of that bug. 

## 2021 01 20

Alright, I think I want a better interface on this servo. Endpoint should be to set pwm by us tick ~ 800 -> 2200 us, full width. I can write the 'abstraction' on top of this. 

So, next up, I'll modify that and do a .write() to do 800-2200 width. 

This is also a place where I'd love for the servo to startup (on power on) at the same place it was left... i.e. so that a tool which was left hanging is re-attached automatically... I'll just have to leave that in firmware for the time being. 

Oy, getting into it. Have to setup the bus again, give this a drop... I should use the dip switches, and setup and endpoint here for the servo command.

- dipswitch bus drop
- endpoint for micros, uint32,
- endpoint to write in js, route, 
- cz-controller head, button does open / close... 

Bless, the dip switch code actually seems like it works OK, and I can still draw these things OK. 

## 2021 01 15

OK, finally through this osap rollup of endpoints - these are the 'source addressed' data objects (i.e. inputs and outputs) that I'd like to use to (re)build this virtual machine with now. 

So - first struggle - if the gcode parser times out, it throws an error, and that should halt the delivery of new codes. But that's fine. 

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