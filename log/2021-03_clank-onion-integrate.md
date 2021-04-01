## 2021 03 27

Have done a big roll through on the 'onion surgery' wherein I rebuilt OSAP to be easier to extend: there's now a core layer / routing structure, and i.e. 'endpoints' which are (can be) more complex software objects / APIs go at the edge of this tree / extend on to it. So I have address / functionality well separated, bless. 

Now I am trying to splice this back into the clank controller. I think most of what I've written might drop right in, but will have to see. 

Nothing to it but to `git do` it. 

Biggest thing so far is modifying routes, which were defined like 

```js 
moveEP.addRoute(TS.route().portf(0).portf(1).end(), TS.endpoint(0, 1), 512)
```

Where the equivalent would now be 

```js
moveEp.addRoute(PK.route().sib(0).portf().sib(1).end(512))
```

So I'll need to track those APIs, which is the real spaghetti. What I want in the future is startups like 

```js
mvoeEp.addRoute(NR.find('moveQueue', 'endpoint'))
```

i.e. searching the graph for an endpoint w/ some name. 

I guess I should resolve this thing in subsets... i.e. do the head, the motion stuff first. Including embedded. 

This is a good chance to build a simple vm as well / improve things down here. It's a lot of assembly, but nice that the tools make this fairly painless. 

I am using lots of 'output' code blocks in the gcode parser, though I think I should more appropriately pass it some virtual machine object to manipulate directly. 

- need new interface for gcode panel -> clank vm... 
- need to swap in lots of routes 

Dangit, first roll on the new embedded bricked it. Bless, just a bad loop term. 

Ah, now I am having a linking issue with the endpoint API in embedded. And maybe more. 

OK, worked through some more indexing troubles and reverted to an older API for building endpoints in embedded. Compiler struggles. The basics seem to be in place now. 

Still some more route management... perhaps when adding to queries, assume swap of sib -> child (?) Just hot swapping in from .sib() to .child() then. 

## 2021 03 28 

Carrying on with the motion stage... 

Seems to be all nearly working, but am not getting any motion. Should inspect interrupts, etc. Had bad type keys for the bus, fixed now. 

Alright so this is jogging one motor. Should be able to flash & connect the rest, check full motion. 

Rad, full motion system looks good. 

OK, ready to get into the heater modules. Going to finish this tonight, if controls lab is complete. 

## 2021 03 29 

OFC not finished last night, still trudging. 

This is all done, save for the toolchanger which I can safely ignore.

Now goals are just to run Filippos' tests, and I need the natural PLA for that. Then I'll be into writing the little 'run test' thing... saving some CSVs, maybe plot a jupyter notebook for them, and deliver the data. Onwards would be integrating the new bed, making the thing useable... starting to print things on it. 

Wonder if I am going to want to make the 'flying xy' version of clank instead... not sure I can deal with this cantilevered z. Mechanical distraction, that. Should make OSAP better documented for others first, probably. 

### Swap Tail

- not 100% on ucBusHead_transmitA(); !warning 
- ucbus head tick is low for the old interrupt bugs, will have to see if they return or if they're OK with FIFO code now 