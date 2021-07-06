# Clank Controller Logs

wherein `cz` should be renamed `fxy` and I reuse this code for *lots of things* 

## Known Issues

- notes in 'virtualMachine.js' on promise timeouts 
- try i.e. sending a 'setcurrent' command while motion is ongoing... seems like some hangup is going on, but should be able to parallelize those 
- the PWM/5V/GND label on the esc board is backwards 
- setcurrent & other (?) ucbus chb transmissions appear to drop the last byte, or something like this - so i.e. remote z current resetting doesn't work 

### Bugs

- wth is this motor knock? 
  - add bypass caps first, might be drivers giving up? 
  - currently: occurs when cscale set above 0.5 
- what are these lost temperature packets?
  - log them when i.e. bad ptr walks 
  - I would say this is not rare, and is likely bus muxing: fix w/ new timebase word delineation 

### Motion Control Wishlist

- integrate the closed loop motors, my dude ! they will wrip !
- consider step/dir network interface rather than (much slower) floating point updates 
  - also 'centralizes' abs-max-rates w/r/t tick timing, which is tite 
- splines, baby: ft. brute force integration lookahead on the GHz micro? 
  - w/ realtime motor feedback / accel state fitting (torque curves, friction estimates) 
  - maybe the above doesn't require splines, consider that 
- bed probe / kinematic corrections 
- mocontrol that lives on the pi / server that lives on the machine 

### Motion Control Closed Loop Overhaul

- CL & OL motors should work together, shouldn't all have to be the same 
- do Z first, avoid this knock 

## 2021 07 05

Working through:

- servo hookup / code 
- heat machines hookup 

Have some error with the servo board... nothing is getting to it. Just address? Just bad code migration, fixed now. Heat machines next. 

- hotend & 'wiring' and filament loom 
- bed & contacts & power draw ? 
- tempvm returns, temppanel as well? 

Alright the bed isn't reading any temps... I think the pogo connectors are not working excellently... I could just solder these mf to start. 

Fixed it with some larger mount holes - then blew up the sense resistor, re-soldered the fets and gate driver, now we're back and it's running. Just need to clean up the temperature panel. That was fast. 

So - the extruder. Looks OK. So systems are all up. 

Last mechanical bug: when the thing is leaned back on a z-drop, the front limit switches don't make. The quick remedy is a few spacers. I'm going to delete the hella-tram clearances on the YLF and YLR assemblies in fusion also, let the thing jam, it might actually be useful. 

Alright - added some spacers, homes should work always now. 

So we are woken up, tomorrow I will be printing & squishing. Maybe making stiffness maps... 

## 2021 07 04 

OK, completing the wake up is:

- jog keys & position keepalive query 
- loadcell hookup, calibration, new code 
- bed, thermistor hookup 
- extruder hookup 

Then I should basically run some test prints - if I am printing by EOD, I should be stoked. 

Jogging is OK but rates are very low. I'm dividing by 60 somewhere I can feel it. Yep - wow, I've been doing that in embedded and in JS! Yeesh. 

Alright fixed it, have the bus malformed-packet bug appearing, no termination available anywhere I'll bet that's what's up - turning the last Z motor on to that now, might help if it's actually bad bytes: if it's this interrupt thing, will have to wait for better bus code. 

So - a keepalive query... 

Since I am querying position on the vm (with the query *and* a jog) twice with the same endpoint, OSAP locks me out from making two queries before either is back. I could amend OSAP to allow it - keeping multiple queries issued from the same node. This is potentially a rabbit hole, but maybe not? I could also implement a js statemachine where if I call the vm.motion.getPos() twice before one comes back, I issue the same reply to both promises. This would keep network traffic lower and is anyways how I thought about doing these kinds of things. 

I could implement that anyways at the .pull() on the core query code. 

Nice, that was like 3 lines of code. Sliq. 

Now lots of firmwares to update for submodule'd code:

- temperature controllers
- loadcell reading 
- servo actuator 

Then it's bringing js machines online for each. 

Awh sheesh the loadcell reading protocol is something I bit banged myself... going to need to read all three channels now. 

That was fine, ~ 3 hours including new calibration. 

Next would be the servo & temperature controllers. Seems like a lot of kit, three days now just on system wake-up! IDK why I always clean code like this. 

## 2021 07 03 

Alright, back at this. First some refreshers: I want a better motor interface / JS-side thing (to run initializations), and then a good homing routine. 

- motor code, cz-head code are not up with new submodule build. 
- thinking about step-via-byte-bit tick rather than floating point witchiness for motion (this is more work) 

Lots to clean here, kind of forever chasing the tail though. One more crack at the motor API is worthwhile... adding those to a vm should make sense to folks. I don't need to change the stepper code to do that, but since I'm making a pass through I might as well. 

Codes are submodul-d at the head and the motor, now for a prettier JS side init / homing / motor abstractions. 

I guess I'm also trying to think of what good JS APIs look like as well. I kind of think passing an object into a function is nice, so arguments are kind of labelled by default. That's a worthy kind of documentation? Maybe a bit of effort to write though... 

I think one confusion also is that I have currently coupled toolchanger, heater, and motors into one 'clank' vm - it could be motion, motors and toolchanger into the clank vm, but hotends etc should be separate (?) though this is kind of the crux, it's also a bit of a distraction. 

Really tearing this thing up again, I guess it's incremental towards a "solid" feeling interface that makes sense. 

UI is going to be *nice* after this (I hope) - first run is to do motion setup, then virtually click motor enable button and loop through its color / states automatically... 

I think having rates / accel settings on the UI page isn't worth it, I'll throw those configs behind the scenes. 

This kind of stuff is a real code-cleanliness rabithole. For settings: I want to write them once and then run setup, but also to use the same API to write-and-update... I could just use a flag. 

w/r/t mm/min or mm/sec spec: I *want* everything to be base mm/sec units, I'll do the conversion *at the gcode* and otherwise treat things in mm/sec. 

The settings-update stuff expands into a rabbit hole of js-object-diffing... 

OK, setup routine feels good for X motor, I'll update firmware on the rest & see if I can keep playing w/ the whole thing. Then a position loop, slightly reworked jogging, and I have a solid base-motion-system-setup. From there is application specific loadcell, hotend / heatbed, etc. I guess I'll wrap it all into one. 

I've all of the motors hooked up - a few things: first off, the og-module motor drivers are not moving, though they're responding to init calls. It might be that the limit doesn't map onto the same pins (?) in the module, but that's not true. I may have just happened to have soldered those limits poorly... 

I might take the time now to swap the z motors all for closed loop anyways: this machine is going to (hopefully) haul big, heavy clay extruders, so we might want the closed loop function. That'd also mean glueing some magnets on each... yeesh. I guess there's no time like the present, it's all in-path anyways, and the XY motors are already setup for this. 

I suspect as well that (as is tradition) as I carry on making this thing work I'll find more bus errors - lost bytes on interrupts. I should see if an update to the D21 timing-based-delineation doesn't help to fix this. 

OK big swap of z-motors, now I'm finding that actually the hangup seems to be in code - yeah, I'm overwriting the serial buffer. That shouldn't happen, so g*damn flow control is broken someplace? 

- writing to home... serial overflow? what gives? 
  - worked before, and I may have decreased serial spaces... 

So I am learning that if we don't do an `await` call before some promise, a failure won't be caught in a try / catch block. These were working fine before I guess because the USB bug wasn't here - not sure where that showed up. I should address it first, it's lower level. 

Yep OK this is bad vertex config on my end - the serialport flowcontrol is not intrinsically linked to the vertex stack sizes - and osap vertex stacks are currently all the same length, which is totally broken. I knew that at least. Vertices here had also been downsized to 128 bytes each - they were previously ~ 512 or 1024 in the D51? So that'd be ~ first order trouble for OSAP. I can fix it by just eating RAM in the D51 though. 

Then, to home synchronously, I'll need a sync-all method... but I can ignore this so long as it works, so I will do for now. 

Last struggle - there's a momentary knock I get when I hold motors above 0.6 (or so?) cscale - shows up after maybe 1 ~ 2 minutes of bare holding. I figure this aught to be a heating thing - drivers getting tired and periodically shutting down. I'll keep my eye on this for sure. 

...

Sheesh, alright well I think the motion systems are... sound-ish by now. As always there's a laundry list of stuff. To get going with actual work, I still have a handful of things

- set 'parked' position after home & have go-to-park button, 
- after setup started, do periodic position updates as a keepalive,
  - if failure, setup btn goes red, otherwise update position ticker 
- rebuild jog... yikes 
  - use textInput.getNumber() method
- hookup the loadcells
- hookup the bed heater & the hotend / extruder motor 
  - init these separately ? probably on-model with the home / motor buttons... that's not bad 
- prep 4 gcode ingestion, test making 

I guess I should try to get that all together by EOD tomorrow. Feels a bit like I'm chasing my tail here: OSAP needs some core work (vertex sizes are not differentiated but should be), and the bus needs some core work (to do timing a-la D21 systems), and I want to get the clay extruder also "going" *and* that might require some closed loop motor hooplah. Indeed it very probably does, to haul this axis. In any case CL motors > OL motors by some degree, and I should have them hooked up regardless. 

## 2021 05 19 

I've homing together, Z being the most difficult - just need to add Y to the routine, attach the bed, then another CAD cycle to think about better bed mounting (I would love to secure it from below to avoid overhanging clips) and to have proper YL/YR limit contact, given the Z belt position. 

Nicely, the Z axis does not 'sink' when the power is off / motors are disengaged, and the Z setup is tolerant to some kinematic out-of-plane action, meaning I will be able to adjust tramming using those kinematics - this is good news for the inevitable slight angular deviation between the bed and i.e. milling tools. 

![home](2021-05-19_clank-fxy-home.mp4) 

## 2021 05 17 

Today I'm wanting to get limit-switch homing up. I figure this is a motor 'endpoint' that tells it to home with 'rate (float / dir), proportion (2nd rate), offset' - after homing, we do a 'set posn' separately, homing doesn't actually modify the 'position' that the stepper tracks. 

Alright so this requires that I have a little bit of 'control' at the stepper... 

I'd like to also improve the motor-config software for the machine... so that I could quickly exclude motors from a 'build' ... but maybe this is later. 

OK, this all works pretty well. I am just using one 'bounce off' which is probably ~ somewhat less accurate than the double tap, but it'll be serviceable for now. Bigger goals are adding things like tramming / bed flatness adjustment to the thing, using some kind of z-motor-matrix of offsets. 

## 2021 02 12 

I clearly want to be done with this phase, but am having small bugs to do with timing details / asynchronousness in the motion queue. 

Sorted those by introducing some delays / adjusting the wait-for-motion time in the remote buffer. Am seeing also spurious timeouts in the system though - I am really starting to tax the bus and asking the network to work all the time... It might be time to do a roll on OSAP subsystems to improve this performance. 

- init on wake-up somehow ? 
- make TC with per-tool setup / abstracted
- pickup / put-down buttons 
- test w/ one tool
- assy t2, test swap, film, done here for now 
- CAD update for probe, print 

## 2021 02 11 

Have been iterating hardware to get ready for toolchangers again. Here's my current burn-down list that I am telling myself I will finish before I get back to making stepper-servo controllers work:

- do per-axis accel & speed limits
- per-axis accels / per axis max rates are osap endpoints (triplets) 
- motor currents go virtual, vmachine sets on 'init'
- vmachine has 'init' for these configs 
- tool swap posn's & hardware debug 
  - demo this / take video ... poke something 
- loadcell endpoint readout
- demo is either print-the-shape and break it, or it's print-anything-and-record-data 
- no probing yet: just print a cube while polling loadcell, temp, and flowrate (?), with timestamps. draw a map or something... you're done for NIST, go do motion control 

So, on with it. Have speed / accel limits, want to test / wrap in UI. 

OK, per-axis accel and speed limits seem to work... want also motor currents, and then some 'startup / OK' term to run at machine init. 

For motors... I have treated these as pretty dumb objects so far, but now that they are on the bus I should be able to do a remote reach-in for SPU, axis pick, and current. That's... pretty rad. I guess I want a kind of 'virtual motor' class then as well. Vey. 

Alright, wrote a lot of lines... I think I am just up to flashing stepper firmwares - now updated so I won't have to do this again to reset SPU / axis etc (bless).... and then having a kind of 'vm init' switch that should reset everything pretty well. Then I'm into tool swapping, I think, god bless? 

Great, that works, nice to have remote settings. Next is tool changing... then I'm into loadcell reading / the loop-poll / display during print. 

... ok, nothing glamorous today. have started on TC macros, will flesh out tomorrow with big morning brain energy. eternal recurrence of 'knocking' motor controller, should fix eventually. 

## 2021 01 30

OK, back at it, want to identify this ongoing extrude bug. Probably should check my calculated length from gcode again, see if that lines up now that I'm not repeating moves. To recount, last time I was shipping 'F-Only' moves again, entirely.   

Yeah, I still see 500mm of extrusion where the slicer reports 400. I suspect this is still on layer changes... and I think this is because I am using stateful 'position' to parse out e-moves... yep, that was also present. I'll test again. 

Alright, nice cubes now

![cube](2021-01-30_extrusion-ok.jpg)

The big goal here is to see if I can make these modular control systems into workhorses: bug-free, tested, reliable, useful. I've a list going for this... there's some near term goals, like adding G92 (just my vm.setPos() hooked up to the gcode interpreter), remote disabling motors, remote setting motor current, etc... features. The longer term goal involves things like (1) putting an offline controller on a raspberry pi, to pop up a display / load jobs / etc, (2) doing a big motion control overhaul to include closed loop motors, or (3) seeing about a python controller on a headless raspberry pi (or similar) etc. There's also the OSAP development cycle: I want to re-assemble system state programmatically from something like a 'virtual machine' to i.e. auto-load in motor axis picks, SPU, current settings, etc... and have typed endpoints, and a graphic language for assembly... and I should keep pushing / seeing about code submodules. 

So, that's a lot. I think that I can do much of this without changing anything too radically yet, so I will keep on towards the NIST goal of tuning / searching for layer adhesion perfection. This means I have a few things to do short-hand:

- yes, 'finish' the VM:
  - per axis acceleration and speed limits, and JS handles for them 
  - wait for heatup,
  - remote set motor currents, 
  - homing would be nice, 
  - make a VM code submodule, a-la the temp, 
- make a bed probe / pull probe loadcell module 
  - CAD,
  - loadcell firmware, 
  - probe test, pull test 
- fix the bed hardware
  - where did the heater go wrong?
  - how to hotswap beds? latches? 
  - bed presence check w/ current sense?
  - better than the RTD? 

After all of this, I can make my way towards (1) printing with a continuous poll for temps / pressures, etc, and / or (2) closed loop simplex search on the bed. 

The thing that excites me a bit more than that is the toolchanger, and hybrid processes, and a closed loop / auto-accel-discovery motion control platform. Some of those might warrant another OSAP development cycle, so I might save them for later. 

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