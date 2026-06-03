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

### Documentation {#documentation}

The purpose of [help text](#help) is to give a brief, immediate sense of what your tool is, what options are available, and how to perform the most common tasks.
Documentation, on the other hand, is where you go into full detail.
It’s where people go to understand what your tool is for, what it _isn’t_ for, how it works and how to do everything they might need to do.

**Provide web-based documentation.**
People need to be able to search online for your tool’s documentation, and to link other people to specific parts.
The web is the most inclusive documentation format available.

**Provide terminal-based documentation.**
Documentation in the terminal has several nice properties: it’s fast to access, it stays in sync with the specific installed version of the tool, and it works without an internet connection.

**Consider providing man pages.**
[man pages](https://en.wikipedia.org/wiki/Man_page), Unix’s original system of documentation, are still in use today, and many users will reflexively check `man mycmd` as a first step when trying to learn about your tool.
To make them easier to generate, you can use a tool like [ronn](http://rtomayko.github.io/ronn/ronn.1.html) (which can also generate your web docs).

However, not everyone knows about `man`, and it doesn’t run on all platforms, so you should also make sure your terminal docs are accessible via your tool itself.
For example, `git` and `npm` make their man pages accessible via the `help` subcommand, so `npm help ls` is equivalent to `man npm-ls`.

```
NPM-LS(1)                                                            NPM-LS(1)

NAME
       npm-ls - List installed packages

SYNOPSIS
         npm ls [[<@scope>/]<pkg> ...]

         aliases: list, la, ll

DESCRIPTION
       This command will print to stdout all the versions of packages that are
       installed, as well as their dependencies, in a tree-structure.

       ...
```

