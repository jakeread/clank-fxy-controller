## 2021 03 27

Have done a big roll through on the 'onion surgery' wherein I rebuilt OSAP to be easier to extend: there's now a core layer / routing structure, and i.e. 'endpoints' which are (can be) more complex software objects / APIs go at the edge of this tree / extend on to it. So I have address / functionality well separated, bless. 

Now I am trying to splice this back into the clank controller. I think most of what I've written might drop right in, but will have to see. 

Nothing to it but to `git do` it. 