# cli-guidelines

Upgrade your CLI 

I went through the https://clig.dev/ documentation and wrote a series of "tests" by hand

This format gives your agent real actionable items for a much more thorough review than a simple summary of the documentation

## Installation

```sh
npx skills add lotap/skills --skill cli-guidelines
```

## Example Usage

### Weather CLI Example

```
Write a CLI tool that fetches the weather for a given city using a mock API. A user should be able to enter a date for weather for a particular day, defaults to today. Add a lunar subcommand that outputs the moon's phase. The mock api should require an API_KEY.
```

#### (Not scientific) Results

1 run of each with [DeepSeek V4 Flash](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash) in [OpenCode](https://opencode.ai/)

The run with the skill produced a cli with better messaging and features (--json and --date flags) and easier-to-follow code. It also asked me which language/framework to use before writing any code. (I ran the "skilled" test second so I chose rust for a more equal comparison)

By contrast, the run without the skill launched into rust without asking. The output is okay, but a little quirky. For some reason it put `weather` as a subcommand. It also made a real mock server - which is cool, but the error message it outputs if it's not reachable is terrible.

##### Output

**with skill**

```sh
$ ./target/debug/weather
Error: API_KEY environment variable is required. Set it and try again.
```

```sh
$ API_KEY=foo ./target/debug/weather
Error: missing CITY argument

Usage:
  weather <CITY> [--date DATE]
  weather lunar [--date DATE]
```

```sh
$ API_KEY=foo ./target/debug/weather Denver
Weather for Denver, 2026-05-27
  Temperature: 13.4°C
  Condition:   Heavy rain
  Humidity:    44%
```

```sh
$ ./target/debug/weather -h
Fetch weather and lunar data

Usage: weather [OPTIONS] [city] [COMMAND]

Commands:
  lunar  Show moon phase
  help   Print this message or the help of the given subcommand(s)

Arguments:
  [city]  City name

Options:
      --json         Output as JSON
  -d, --date <date>  Date in YYYY-MM-DD format (default: today)
  -h, --help         Print help
  -V, --version      Print version
```

**without skill**

```sh
$ ./target/debug/cligtest
Weather & moon phase CLI

Usage: cligtest <COMMAND>

Commands:
  weather  Get weather for a city
  lunar    Get moon phase
  serve    Start mock API server
  help     Print this message or the help of the given subcommand(s)

Options:
  -h, --help     Print help
  -V, --version  Print version
```

```sh
$ ./target/debug/cligtest weather
error: the following required arguments were not provided:
  <CITY>

Usage: cligtest weather <CITY> [DATE]

For more information, try '--help'.
```

```sh
$ ./target/debug/cligtest weather Denver
Error: API_KEY environment variable not set
```

```sh
$ API_KEY=foo ./target/debug/cligtest weather Denver
Error: error sending request for url (http://localhost:3000/weather?city=Denver&date=2026-05-27)

Caused by:
    0: client error (Connect)
    1: tcp connect error
    2: Connection refused (os error 61)
```

##### Source Code

**with skill**

<details>
<summary>`main.rs`</summary>

```rust
mod cli;
mod mock_api;

use cli::{build_cli, Action};
use mock_api::{check_api_key, fetch_weather, moon_phase};

fn main() {
    let cli = build_cli();
    let matches = cli.get_matches();

    let api_key = match check_api_key() {
        Ok(k) => k,
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    };

    match cli::parse(matches) {
        Action::Weather { city, date, json } => {
            if city.is_empty() {
                eprintln!("Error: missing CITY argument");
                eprintln!();
                eprintln!("Usage:");
                eprintln!("  weather <CITY> [--date DATE]");
                eprintln!("  weather lunar [--date DATE]");
                std::process::exit(1);
            }
            match fetch_weather(&api_key, &city, date.as_deref()) {
                Ok(report) => {
                    if json {
                        let out = serde_json::json!({
                            "city": report.city,
                            "date": report.date.to_string(),
                            "temp_c": report.temp_c,
                            "condition": report.condition,
                            "humidity": report.humidity,
                        });
                        println!("{}", serde_json::to_string_pretty(&out).unwrap());
                    } else {
                        println!("Weather for {}, {}", report.city, report.date);
                        println!("  Temperature: {:.1}°C", report.temp_c);
                        println!("  Condition:   {}", report.condition);
                        println!("  Humidity:    {}%", report.humidity);
                    }
                }
                Err(e) => {
                    eprintln!("Error: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Action::Lunar { date, json } => match moon_phase(&api_key, date.as_deref()) {
            Ok(phase) => {
                if json {
                    let out = serde_json::json!({ "phase": phase });
                    println!("{}", serde_json::to_string_pretty(&out).unwrap());
                } else {
                    println!("{}", phase);
                }
            }
            Err(e) => {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        },
    }
}

```

</details>

<details>
<summary>`cli.rs`</summary>

```rust
use clap::{Arg, ArgAction, ArgMatches, Command};

pub fn build_cli() -> Command {
    Command::new("weather")
        .about("Fetch weather and lunar data")
        .version("0.1.0")
        .subcommand_required(false)
        .arg_required_else_help(false)
        .arg(
            Arg::new("json")
                .long("json")
                .help("Output as JSON")
                .global(true)
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("city")
                .index(1)
                .help("City name")
                .required(false),
        )
        .arg(
            Arg::new("date")
                .short('d')
                .long("date")
                .help("Date in YYYY-MM-DD format (default: today)")
                .required(false),
        )
        .subcommand(
            Command::new("lunar")
                .about("Show moon phase")
                .arg(
                    Arg::new("date")
                        .short('d')
                        .long("date")
                        .help("Date in YYYY-MM-DD format (default: today)")
                        .required(false),
                ),
        )
}

pub enum Action {
    Weather { city: String, date: Option<String>, json: bool },
    Lunar { date: Option<String>, json: bool },
}

pub fn parse(matches: ArgMatches) -> Action {
    let json = matches.get_flag("json");

    if let Some(lunar_matches) = matches.subcommand_matches("lunar") {
        let date = lunar_matches.get_one::<String>("date").cloned();
        Action::Lunar { date, json }
    } else {
        let city = matches
            .get_one::<String>("city")
            .cloned()
            .unwrap_or_default();
        let date = matches.get_one::<String>("date").cloned();
        Action::Weather { city, date, json }
    }
}

```
</details>

**without skill**

<details>
<summary>`main.rs`</summary>

```rust
mod cli;
mod client;
mod server;
mod types;

use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = cli::Cli::parse();

    match cli.command {
        cli::Command::Weather { city, date } => {
            client::fetch_weather(&city, date).await?;
        }
        cli::Command::Lunar { date } => {
            client::fetch_lunar(date).await?;
        }
        cli::Command::Serve { port } => {
            server::run(port).await?;
        }
    }

    Ok(())
}

```
</details>

<details>
<summary>`cli.rs`</summary>

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "cligtest", about = "Weather & moon phase CLI", version)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand)]
pub enum Command {
    /// Get weather for a city
    Weather {
        city: String,
        date: Option<String>,
    },
    /// Get moon phase
    Lunar {
        date: Option<String>,
    },
    /// Start mock API server
    Serve {
        #[arg(short, long, default_value = "3000")]
        port: u16,
    },
}
```
</details>

<details>
<summary>`client.rs`</summary>

```rust
use crate::types;
use chrono::Local;
use reqwest::Client;
use std::env;

fn api_base_url() -> String {
    env::var("API_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".into())
}

pub async fn fetch_weather(city: &str, date_opt: Option<String>) -> anyhow::Result<()> {
    let key = env::var("API_KEY")
        .map_err(|_| anyhow::anyhow!("API_KEY environment variable not set"))?;
    let date = date_opt.unwrap_or_else(|| Local::now().format("%Y-%m-%d").to_string());

    let client = Client::new();
    let resp = client
        .get(format!("{}/weather", api_base_url()))
        .header("X-API-Key", &key)
        .query(&[("city", city), ("date", &date)])
        .send()
        .await?;

    let status = resp.status();
    if !status.is_success() {
        let err: types::ErrorResponse = resp.json().await?;
        anyhow::bail!("API error ({}): {}", status.as_u16(), err.error);
    }

    let w: types::WeatherResponse = resp.json().await?;
    println!("Weather in {} on {}:", w.city, w.date);
    println!("  Temperature: {}°C", w.temperature);
    println!("  Condition: {}", w.condition);
    println!("  Humidity: {}%", w.humidity);

    Ok(())
}

pub async fn fetch_lunar(date_opt: Option<String>) -> anyhow::Result<()> {
    let key = env::var("API_KEY")
        .map_err(|_| anyhow::anyhow!("API_KEY environment variable not set"))?;
    let date = date_opt.unwrap_or_else(|| Local::now().format("%Y-%m-%d").to_string());

    let client = Client::new();
    let resp = client
        .get(format!("{}/lunar", api_base_url()))
        .header("X-API-Key", &key)
        .query(&[("date", &date)])
        .send()
        .await?;

    let status = resp.status();
    if !status.is_success() {
        let err: types::ErrorResponse = resp.json().await?;
        anyhow::bail!("API error ({}): {}", status.as_u16(), err.error);
    }

    let l: types::LunarResponse = resp.json().await?;
    println!("Moon phase on {}:", l.date);
    println!("  Phase: {}", l.phase);
    println!("  Illumination: {:.1}%", l.illumination * 100.0);

    Ok(())
}
```
</details>

#### Refinement

I used this prompt on the output of the "skilled" output to see if it would pick up any issues it missed in code generation.

`review the output of the entire program. Make sure it all aligns with cli best practices.`

That resulted in 12 issues found and this table:

|Priority | Issue	| Where
| --- | --- | --- |
|High | No example usages in help | src/cli.rs — build_cli()
|High | No suggestions after output | src/main.rs — after println! blocks
|Medium | No color support with TTY gating | src/main.rs — output formatting
|Medium | Exit codes not differentiated | src/main.rs — exit(1) calls
|Medium | No links to docs/issues | src/cli.rs — build_cli()
|Low | No no-args interactive prompt | src/main.rs — city missing path
|Low | No .env support | src/mock_api.rs — check_api_key()
|Low | No --no-input / --verbose / -q flags | src/cli.rs — missing arg definitions

Interestingly, not all of the issues made it to the table, it deemed some of them as not worth it for a small project. (Using credential files instead of env vars for the API_KEY and man page support were cut)

I told it to `proceed with changes`

##### Updated Output

```sh
$ ./target/debug/weather
Fetch weather and lunar data

Usage: weather [OPTIONS] [city] [COMMAND]

Commands:
  lunar  Show moon phase
  help   Print this message or the help of the given subcommand(s)

Arguments:
  [city]  City name

Options:
      --json         Output as JSON
      --no-input     Disable interactive prompts
  -v, --verbose      Show verbose output
  -d, --date <date>  Date in YYYY-MM-DD format (default: today)
  -h, --help         Print help (see more with '--help')
  -V, --version      Print version

Examples:
  weather London                      Show weather for London
  weather London --date 2026-06-01    Weather on a specific date
  weather lunar                       Show today's moon phase
```

```sh
$ ./target/debug/weather Denver
Error: API_KEY environment variable is required. Set it and try again.
```

```sh
$ API_KEY=foo ./target/debug/weather Denver
Weather for Denver, 2026-05-27
  Temperature: 13.4°C
  Condition:   Heavy rain
  Humidity:    44%

Hint: try `weather lunar` for moon phase, or use `--date` for a different date
```


## License

This work is derived from https://clig.dev/

In accordance with [that project's license](https://github.com/cli-guidelines/cli-guidelines?tab=CC-BY-SA-4.0-1-ov-file), this skill also uses the [Creative Commons Attribution Share Alike 4.0 International License](./LICENSE)