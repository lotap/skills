## Guidelines {#guidelines}

This is a collection of specific things you can do to make your command-line program better.

The first section contains the essential things you need to follow.
Get these wrong, and your program will be either hard to use or a bad CLI citizen.

The rest are nice-to-haves.
If you have the time and energy to add these things, your program will be a lot better than the average program.

The idea is that, if you don’t want to think too hard about the design of your program, you don’t have to: just follow these rules and your program will probably be good.
On the other hand, if you’ve thought about it and determined that a rule is wrong for your program, that’s fine.
(There’s no central authority that will reject your program for not following arbitrary rules.)

Also—these rules aren’t written in stone.
If you disagree with a general rule for good reason, we hope you’ll [propose a change](https://github.com/cli-guidelines/cli-guidelines).

### Robustness {#robustness-guidelines}

**Validate user input.**
Everywhere your program accepts data from the user, it will eventually be given bad data.
Check early and bail out before anything bad happens, and [make the errors understandable](#errors).

**Responsive is more important than fast.**
Print something to the user in <100ms.
If you’re making a network request, print something before you do it so it doesn’t hang and look broken.

**Show progress if something takes a long time.**
If your program displays no output for a while, it will look broken.
A good spinner or progress indicator can make a program appear to be faster than it is.

Ubuntu 20.04 has a nice progress bar that sticks to the bottom of the terminal.

<!-- (TK reproduce this as a code block or animated SVG) -->

If the progress bar gets stuck in one place for a long time, the user won’t know if stuff is still happening or if the program’s crashed.
It’s good to show estimated time remaining, or even just have an animated component, to reassure them that you’re still working on it.

There are many good libraries for generating progress bars.
For example, [tqdm](https://github.com/tqdm/tqdm) for Python, [schollz/progressbar](https://github.com/schollz/progressbar) for Go, and [node-progress](https://github.com/visionmedia/node-progress) for Node.js.

**Do stuff in parallel where you can, but be thoughtful about it.**
It’s already difficult to report progress in the shell; doing it for parallel processes is ten times harder.
Make sure it’s robust, and that the output isn’t confusingly interleaved.
If you can use a library, do so—this is code you don’t want to write yourself.
Libraries like [tqdm](https://github.com/tqdm/tqdm) for Python and [schollz/progressbar](https://github.com/schollz/progressbar) for Go support multiple progress bars natively.

The upside is that it can be a huge usability gain.
For example, `docker pull`’s multiple progress bars offer crucial insight into what’s going on.

```
$ docker image pull ruby
Using default tag: latest
latest: Pulling from library/ruby
6c33745f49b4: Pull complete 
ef072fc32a84: Extracting [================================================>  ]  7.569MB/7.812MB
c0afb8e68e0b: Download complete 
d599c07d28e6: Download complete 
f2ecc74db11a: Downloading [=======================>                           ]  89.11MB/192.3MB
3568445c8bf2: Download complete 
b0efebc74f25: Downloading [===========================================>       ]  19.88MB/22.88MB
9cb1ba6838a0: Download complete 
```

One thing to be aware of: hiding logs behind progress bars when things go _well_ makes it much easier for the user to understand what’s going on, but if there is an error, make sure you print out the logs.
Otherwise, it will be very hard to debug.

**Make things time out.**
Allow network timeouts to be configured, and have a reasonable default so it doesn’t hang forever.

**Make it recoverable.**
If the program fails for some transient reason (e.g. the internet connection went down), you should be able to hit `<up>` and `<enter>` and it should pick up from where it left off.

**Make it crash-only.**
This is the next step up from idempotence.
If you can avoid needing to do any cleanup after operations, or you can defer that cleanup to the next run, your program can exit immediately on failure or interruption.
This makes it both more robust and more responsive.

_Citation: [Crash-only software: More than meets the eye](https://lwn.net/Articles/191059/)._

**People are going to misuse your program.**
Be prepared for that.
They will wrap it in scripts, use it on bad internet connections, run many instances of it at once, and use it in environments you haven’t tested in, with quirks you didn’t anticipate.
(Did you know macOS filesystems are case-insensitive but also case-preserving?)

