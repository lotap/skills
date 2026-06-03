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

### Interactivity {#interactivity}

**Only use prompts or interactive elements if `stdin` is an interactive terminal (a TTY).**
This is a pretty reliable way to tell whether you’re piping data into a command or whether it's being run in a script, in which case a prompt won’t work and you should throw an error telling the user what flag to pass.

**If `--no-input` is passed, don’t prompt or do anything interactive.**
This allows users an explicit way to disable all prompts in commands.
If the command requires input, fail and tell the user how to pass the information as a flag.

**If you’re prompting for a password, don’t print it as the user types.**
This is done by turning off echo in the terminal.
Your language should have helpers for this.

**Let the user escape.**
Make it clear how to get out.
(Don’t do what vim does.)
If your program hangs on network I/O etc, always make Ctrl-C still work.
If it’s a wrapper around program execution where Ctrl-C can’t quit (SSH, tmux, telnet, etc), make it clear how to do that.
For example, SSH allows escape sequences with the `~` escape character.

