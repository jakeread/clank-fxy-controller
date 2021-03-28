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

### Swap Tail

- not 100% on ucBusHead_transmitA(); !warning 