#![feature(proc_macro_hygiene, decl_macro)]
#[macro_use] extern crate rocket;
#[macro_use] extern crate serde_json;
#[macro_use] extern crate serde_derive;

use rocket::{Request, Response};
use rocket::fairing::{Fairing, Info, Kind};
use rocket::http::{Header, ContentType, Method};

use serde::Deserialize;
use rocket_contrib::json::Json;

mod statemap;
use statemap::*;

use uuid::Uuid;
use std::fs::File;
use std::io::prelude::*;
use std::io::Cursor;
use std::error::Error;

#[derive(Deserialize)]
struct PostConfig {
    begin: i64,
    end: i64,
    coalesce: u64,
    json: bool,
    buffer: String
}

#[get("/")]
fn index() -> &'static str {
    "Hello, world!"
}

#[options("/")]
fn opts() -> &'static str {
    ""
}

#[post("/", data = "<config>")]
fn statemap(config: Json<PostConfig>) -> String {
    // Convert POST config into SVG Config
    // Generate SVG with Statemap module
    // Respond with the SVG

    // Write buffer to a file...not ideal but it works
    // let filename = Uuid::new_v4() + ".txt";
    // let mut file = File::create(filename)?;
    // file.write_all(config.buffer)?;

    let filename = String::from(Uuid::new_v4().to_simple().to_string() + ".txt");
    match write_buffer(&filename, &config.buffer) {
        Ok(_) => {},
        Err(_) => {}
    }

    // Configuration for Statemap generation
    let smconf = Config {
        begin: config.begin,
        end: config.end,
        notags: false,
        abstime: false,
        maxrect: config.coalesce,
        .. Default::default()
    };

    // Configuration for SVG generation
    let svgconf: StatemapSVGConfig = Default::default();

    let mut statemap = Statemap::new(&smconf);
    match statemap.ingest(filename.as_str()) {
        Err(f) => { panic!("Could not ingest {}: {}", filename, f); }
        Ok(k) => { k }
    }

    let svg = StatemapSVG::new(&svgconf);
    let statemaps: Vec<Statemap> = vec![statemap];
    match svg.output(&statemaps) {
        Err(f) => { format!("{}", f) }
        Ok(svgstr) => { svgstr }
    }
}

fn write_buffer(filename: &String, buffer: &String) -> Result<(), Box<dyn Error>> {
    let mut file = File::create(filename)?;
    file.write_all(buffer.as_bytes())?;
    Ok(())
}

pub struct CORS();

impl Fairing for CORS {
    fn info(&self) -> Info {
        Info {
            name: "Add CORS headers to requests",
            kind: Kind::Response
        }
    }

    fn on_response(&self, request: &Request, response: &mut Response) {
        println!("CORS is here");
        response.set_header(Header::new("Access-Control-Allow-Origin", "*"));
        response.set_header(Header::new("Access-Control-Allow-Methods", "HEAD, POST, GET, OPTIONS"));
        response.set_header(Header::new("Access-Control-Allow-Headers", "*"));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));

        if request.method() == Method::Options {
            response.set_header(ContentType::Plain);
            response.set_sized_body(Cursor::new(""));
        }
    }
}

fn main() {
    rocket::ignite()
        .attach(CORS())
        .mount("/", routes![index, statemap, opts])
        .launch();
}
