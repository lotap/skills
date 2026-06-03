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

### Analytics {#analytics}

Usage metrics can be helpful to understand how users are using your program, how to make it better, and where to focus effort.
But, unlike websites, users of the command-line expect to be in control of their environment, and it is surprising when programs do things in the background without telling them.

**Do not phone home usage or crash data without consent.**
Users will find out, and they will be angry.
Be very explicit about what you collect, why you collect it, how anonymous it is and how you go about anonymizing it, and how long you retain it for.

Ideally, ask users whether they want to contribute data (“opt-in”).
If you choose to do it by default (“opt-out”), then clearly tell users about it on your website or first run, and make it easy to disable.

Examples of projects that collect usage statistics:

- Angular.js [collects detailed analytics using Google Analytics](https://angular.io/analytics), in the name of feature prioritization.
  You have to explicitly opt in.
  You can change the tracking ID to point to your own Google Analytics property if you want to track Angular usage inside your organization.
- Homebrew sends metrics to Google Analytics and has [a nice FAQ](https://docs.brew.sh/Analytics) detailing their practices.
- Next.js [collects anonymized usage statistics](https://nextjs.org/telemetry) and is enabled by default.

**Consider alternatives to collecting analytics.**

- Instrument your web docs.
  If you want to know how people are using your CLI tool, make a set of docs around the use cases you’d like to understand best, and see how they perform over time.
  Look at what people search for within your docs.
- Instrument your downloads.
  This can be a rough metric to understand usage and what operating systems your users are running.
- Talk to your users.
  Reach out and ask people how they’re using your tool.
  Encourage feedback and feature requests in your docs and repos, and try to draw out more context from those who submit feedback.

_Further reading: [Open Source Metrics](https://opensource.guide/metrics/)_

