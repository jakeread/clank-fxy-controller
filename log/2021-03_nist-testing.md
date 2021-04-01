## 2021 03 31 

OK the testing: this doesn't have to be complicated, I'm going to run each one on one click, save file w/ temp & speed. Then wait 5 minutes... 

Ah and I'm just updating how speed is calculated in smoothie and realize I am running this at 25kHz not 100, so speeds have been 1/4 what they were. 

Resetting this means bringing the bus back up to 3mbaud, so I'll have to be weary of those old errors again. Will check... 

So, have retrieved some of these errors that I believe are interrupt handling struggles. This means that if I want to run at 3mBaud, I probably need 32bit words. That'd be a minute of development. 

Reset all of that, now am runnign at 1mbaud and 25khz tick, for 1khz stepper position update only (yikes). Still can't get a reliable speed metric back (?) 

Woof. IDK. 

- query w/ no resolution on test startup 
- speed (?) 
    - test other motors... 

OK the speed is something w/ how extruder speeds are set... other axis do seem to work well. ! Doesn't make a huge amount of sense to me why... 

I guess the query / no resolution and lack of speed on the extruder could be related: with minimal accel, E speeds are vanishing (in time) so I don't retrieve them with the query. If something is messed up in the query on the longer tests, maybe it's just never making its way back. 

Ah, this was a case where I was querying something twice(?) before clearing one. 

This day is cursed? Even more struggles appearing now... 

- have frequency mismatch someplace, works when convinced is running at 100khz, is only actually running at 25khz. 

All of this reminds me I am in sore need of better motion control... and should definitely make the raspberry pi / python mocontrol a priority. 

For now I can hack my way around this by *= speeds, rates by 4, but that's hardly going to make things "work well" ... and I still have this (?) speed measurement struggle, which is also bad motion control accessibility, which I can also likely fix with i.e. rasbpi, but should do for now with the older ->step() calculation. 

- redo step() calculation 
- *= 4 for rates, accels, etc... 
- can make tests yet? 

OK I'm figuring out this frequency thing: it's a max_rate issue, which is limited by stepper SPU and ticker frequency. 

Now I just have again some miss in my speed measurement, by one order of magnitude exactly. I believe this was just a mutliplication by 100k, where it should have been by 1m to get timebase from microseconds to seconds. 

Well! Today felt like a wash. Did get that data to filippos, I think I am still feeling sort of aimless? Things not going as fast as I had hoped. Probably this is me sinking into it after having not taken a day off. 

I am ostensibly here to work for another few hours, it's 9pm now. I wanted to get a post up for tomorrow on OSAP / how to write virtual machines. 

I guess it's just a tonne of git cleanup... merge the onions into the masters. Tomorrow (or starting tonight) I can start on the write up. 

- clank-cz-controller
    - osape to master merge
    - rm closed loop tool changer 
    - possible to abandon firmware here & use ucbus head ? 
- psu-breakout 
    - firmware to osape master 
    - rename / move firmware (?) 
- same for
    - ucbus-stepper
    - heater-module
    - loadcell-amp 