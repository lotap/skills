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

### Errors {#errors}

One of the most common reasons to consult documentation is to fix errors.
If you can make errors into documentation, then this will save the user loads of time.

**Catch errors and rewrite them for humans.**
If you’re expecting an error to happen, catch it and rewrite the error message to be useful.
Think of it like a conversation, where the user has done something wrong and the program is guiding them in the right direction.
Example: “Can’t write to file.txt. You might need to make it writable by running ‘chmod +w file.txt’.”

**Signal-to-noise ratio is crucial.**
The more irrelevant output you produce, the longer it’s going to take the user to figure out what they did wrong.
If your program produces multiple errors of the same type, consider grouping them under a single explanatory header instead of printing many similar-looking lines.

**Consider where the user will look first.**
Put the most important information at the end of the output.
The eye will be drawn to red text, so use it intentionally and sparingly.

**If there is an unexpected or unexplainable error, provide debug and traceback information, and instructions on how to submit a bug.**
That said, don’t forget about the signal-to-noise ratio: you don’t want to overwhelm the user with information they don’t understand.
Consider writing the debug log to a file instead of printing it to the terminal.

**Make it effortless to submit bug reports.**
One nice thing you can do is provide a URL and have it pre-populate as much information as possible.

_Further reading: [Google: Writing Helpful Error Messages](https://developers.google.com/tech-writing/error-messages), [Nielsen Norman Group: Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines)_

