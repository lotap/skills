## Foreword {#foreword}

In the 1980s, if you wanted a personal computer to do something for you, you needed to know what to type when confronted with `C:\>` or `~$`.
Help came in the form of thick, spiral-bound manuals.
Error messages were opaque.
There was no Stack Overflow to save you.
But if you were lucky enough to have internet access, you could get help from Usenet—an early internet community filled with other people who were just as frustrated as you were.
They could either help you solve your problem, or at least provide some moral support and camaraderie.

Forty years later, computers have become so much more accessible to everyone, often at the expense of low-level end user control.
On many devices, there is no command-line access at all, in part because it goes against the corporate interests of walled gardens and app stores.

Most people today don’t know what the command line is, much less why they would want to bother with it.
As computing pioneer Alan Kay said in [a 2017 interview](https://www.fastcompany.com/40435064/what-alan-kay-thinks-about-the-iphone-and-technology-now), “Because people don't understand what computing is about, they think they have it in the iPhone, and that illusion is as bad as the illusion that 'Guitar Hero' is the same as a real guitar.”

Kay’s “real guitar” isn’t the CLI—not exactly.
He was talking about ways of programming computers that offer the power of the CLI and that transcend writing software in text files.
There is a belief among Kay’s disciples that we need to break out of a text-based local maximum that we’ve been living in for decades.

It’s exciting to imagine a future where we program computers very differently.
Even today, spreadsheets are by far the most popular programming language, and the no-code movement is taking off quickly as it attempts to replace some of the intense demand for talented programmers.

Yet with its creaky, decades-old constraints and inexplicable quirks, the command line is still the most _versatile_ corner of the computer.
It lets you pull back the curtain, see what’s really going on, and creatively interact with the machine at a level of sophistication and depth that GUIs cannot afford.
It’s available on almost any laptop, for anyone who wants to learn it.
It can be used interactively, or it can be automated.
And, it doesn’t change as fast as other parts of the system.
There is creative value in its stability.

So, while we still have it, we should try to maximize its utility and accessibility.

A lot has changed about how we program computers since those early days.
The command line of the past was _machine-first_: little more than a REPL on top of a scripting platform.
But as general-purpose interpreted languages have flourished, the role of the shell script has shrunk.
Today's command line is _human-first_: a text-based UI that affords access to all kinds of tools, systems and platforms.
In the past, the editor was inside the terminal—today, the terminal is just as often a feature of the editor.
And there’s been a proliferation of `git`-like multi-tool commands.
Commands within commands, and high-level commands that perform entire workflows rather than atomic functions.

Inspired by traditional UNIX philosophy, driven by an interest in encouraging a more delightful and accessible CLI environment, and guided by our experiences as programmers, we decided it was time to revisit the best practices and design principles for building command-line programs.

Long live the command line!

