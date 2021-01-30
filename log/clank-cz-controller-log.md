## Known Issues

- notes in 'virtualMachine.js' on promise timeouts 
- try i.e. sending a 'setcurrent' command while motion is ongoing... seems like some hangup is going on, but should be able to parallelize those 
- the PWM/5V/GND label on the esc board is backwards 
- setcurrent & other (?) ucbus chb transmissions appear to drop the last byte, or something like this - so i.e. remote z current resetting doesn't work 

### Clank CZ New Controller 

- change gcode parsing system: maybe delete these js modules, instead do direct vm call / which returns the osap.write() ? or so, idk how you want to do this 
- gcode delivery: need to change the timeout scale here to await those long acks for potentially lengthy gcodes... 

### Friday

### Bugs

- stress test jogging: what's up with this "recieved ... for unregistered query... ?" business? polling is using network bandwidth, more stuff showing up... I think this is the desire to make a more-robust network. fuzz testing, flow control that rocks, etc. a challenge 
- extruder moves: are scaled to volume, but moves are linear? 
  - or simple over-extrusion? calculate the extruder SPU 
  - do test prints w/ no retraction, to get basics straight
  - add retraction, see if maybe direction misses, or something? 
- during temp. polling, often find "bad walk for ptr key 1 at 0" - what's this? 

### Motion Control Wishlist

- per axis acceleration & top speed settings
- G92 that works... shouldn't be too difficult 
- to eliminate these mystery extrusions 
- wth is this motor knock? 
  - add bypass caps first, might be drivers giving up? 
- what are these lost temperature packets?
  - log them when i.e. bad ptr walks 
- NIST goal is to have dense path data: at each poll, get position, extrusion rate, load, temps ... this means good querying, and probably in bus time-base. 

### Motion Control Closed Loop Overhaul

- CL & OL motors should work together, shouldn't all have to be
- do Z first, avoid this knock 

## 2021 01 30

OK, back at it, want to identify this ongoing extrude bug. Probably should check my calculated length from gcode again, see if that lines up now that I'm not repeating moves. To recount, last time I was shipping 'F-Only' moves again, entirely. 

## 2021 01 29 

Back at it now, had a few days off. Have resolved extruder only moves (afaik), but am not able to test at the moment because it's -12 degs c outside and the garage is cold as ever. 

I seem to have an overextrusion issue though, so I'll have to test that the old fasioned way / calibrating length of plastic on an extruder jog. 

This is a bit confusing, the slicer reports about 430mm of extrusion (in length) and 1046mm^3 of volume. If I just add up all of the extruder moves, I see about 630mm of extrusion (just in the gcode). If I exclude e-only moves (which are retracts / resets) I see 731. 

This is just on the gcode side, not even looking at firmware. 

I removed retractions from the gcode (since it sounds like they are normally specified in linear mm, even where extrusion is spec'd in volumetric mm) and the thing is pretty clearly outputting volumetric E values, though it is *not* ticked in the settings. And when it is ticked, I see 300mm of extrude value, where I am expecting 162. 

So some kind of insanity is going on here, I think I need the machine to really work it out though - I can maybe just guess at prefactors until it works. 

I should perhaps try setting up per-axis accel here, as well, but am weary of running two tests at once. 

Have:

51.3 reported / 81.9 used (5mm cube) (62%)
411 reported / 572 used (10mm cube) (71%)
1353 reported / 1734 used (15mm cube) (77%)

Yeah, just have to test this, I'm bringing the machine inside. 

OK, found one real error: was extruding 150% too much, just based on extruder steps per unit. So, will see if I still have sloppy extrudes when I run this... first with no retraction at all. 

Extrusion for the most part looks clean, but I see odd artefacts on corners, and I get the sense this is a g-code bug, not a firmware bug. 

This might be my parsing, and yeah - indeed. On moves w/ just an F term, I was re-transmitting the whole move, causing it to execute some zero delta (motion) but positive delta (extrusion) moves. 

![lr](2021-01-29_extrusion-sorting-01.jpg)

I've also got this bug (flaw) where the z-motor gives up occasionally, dropping the bed. I think to fix this I want per-axis accel, low on the z, so it doesn't get whacked. Outside of that, I'm underpowered, but when I turn the current scaling up I get an odd 'knocking' sound out of the motors, so the driver needs to be interrogated a bit. I'll do one thing at a time, though. You can catch it *just* at the end of this clip:

![drop](2021-01-29_clank-printing-drop.mp4)

So... this extruder bug. I should interrogate the GCodes a bit more, seeming sus after that last bug. 

## 2021 01 24 

Trying to button this up now, 

OK, making the temp controller modular is kind of a trick... want modular code in the vm, and in the ui. 

Have this wired up, now it's a pain to be looking at these DIP switches and de-muxing addresses. The rendered network is illegible because I'm drawing names overtop of other endpoints, so I could fix this, and append the bus-indice to each, so that I can do this visually.

I'm also having, I think, bus-ack timeouts, probably lost acks at the endpoints... so I maybe do need to implement either a bus-return buffer (easier) or some other holding pattern. 

Coming together slowly, had some bus drop ID collisions, more reason to want a pass-thru bus... simpler in some ways, less in others. Oy. Maybe network-test-boards are a next pick. 

So, working in the heater code block for a minute, going to add a tx buffer to bus drops, I am timing out acks there, pretty obviously. Also need to add some code to turn on the 1st fan here, and add that to the hotend. 

OK, this new code though, I suspect because of the loop, causes the steppers to perform poorly, I think because the DACs need to be re-written more often than they are... welp. That doesn't seem like it, so I'm a bit mystified. 

Suppose I should try rolling back the osape submodule, building, see if that does it.

This was just not designating the `F` on the SPU, whoops. All set now, and I think I'm ready to try to print something.

Pretty sure extruder only moves are not being executed, so I'll have to fix that as well... or delete them? Might just go ahead and try anyways, to start. 

Wew, I'm testing - and it's working, except these missed extruder-only moves really don't do us any good. Also, the z-motor crashed, so I'll up the current there (and should replace these all with closed loop anyways). 

I think I'll make the push tonight to fix the extruder only moves, so that I can maybe get a cube out to show off tomorrow. Otherwise, I am nearly done with this trip around the dev cycle. 

### E-Only Moves

the code I'm missing in my smoothie roll is in robot.cpp from `962`. 

## 2021 01 23 

Heater controllers now, notes in the heater circuit page, likely. 

OK, bed and hotend are heating, tomorrow I just need to do these things:

- add fan to hotend 
- put heaters on the bus, two heater code modules / plots 
- runtime heater plots / etc (?) 
- gcode await for heaters, 
- 'home' to z-up, 
- test gcode ? 

... then I can either call it, or get to work reading that loadcell, to see if I can make some spatial data plots, which would be cool, but also could be done for next month.

## 2021 01 22 

Have today, tomorrow, sunday, to wrap this up. 

### E-Moves in the SmoothieRoll

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

Working through it... OK, now it makes E moves. Basically the same thing as I did last time, but with some more understanding, not sure what was different, that's what happens when you pay a little bit of attention, I suppose. 

This was testing on some simple gcode, I should get back to the printer codes and see what's different. This also seems to work OK. That's rad, now I can move on. 

### Machine Config

At this point, this is:
  - pushing stepper code to each axis, 
  - configuring SPU at each axis / direction, etc 
  - testing this beta gcode
    - some z-init to walk it up... might need big torque / low accel there 

I might want to have a jogging system at this point, but it might not be worth it for the demo, just go straight to the heart... Then I should get started with heater PID controllers, that's ideally just one piece of code for both drops. I can use endpoints to write the different PID values for each on startup. Might need the 1kW PSU to heat this bed, might trip the breaker in the nook. 

OK, have SPUs all setup, I think next is just writing some little function to bring the z to zero at startup, as it falls on power down. That's... should be mechanically designed out next time -> I think probably a floating XY stage would be the coolest way to do this machine, now that I see how heavy beds want to be. Leadscrew drive would do the same thing, though, and I could keep the rest of the design stable. IDK about that: later. 

So: tomorrow: 
  - write the 'set pos' stuff... don't reinvent, go thru CHA
  - test the beta GCode, have vm handles for temp setting, empty
  - start heater dev: on hotend first, poll for thermistor, turn heater on / off au manuel, get into PID, endpoints, it's all kind of working... 

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