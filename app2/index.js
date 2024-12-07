//Dependencies
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cookieParser = require("cookie-parser");
const ejsMate = require("ejs-mate");
var jwt = require("jsonwebtoken");
const Str_Random = require("./generate_random_string.js");
require("dotenv").config({
  path: "/.env",
});
require("dotenv/config");

//App Setup
app.use(cookieParser());
app.use(express.urlencoded());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "static")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

const port = process.env.PORT || 8001;
const SECRET_KEY = String(Str_Random(32));
const auth_token = process.env.AUTH_TOKEN;

// Declare database
const db = new sqlite3.Database(
  path.join(__dirname, "uuid-vulnerable-app-2.db"),
  function (error) {
    if (error) {
      return console.error(error.message);
    } else {
      console.log("Connection with Database has been established.");
    }
  }
);

//Create table
function createTables() {
  db.exec(`
          DROP TABLE IF EXISTS users;
          CREATE TABLE users
          (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT,
              password TEXT,
              role TEXT
          );
  
          DROP TABLE IF EXISTS emails;
          CREATE TABLE emails
          (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT,
              sender TEXT,
              subject TEXT,
              body TEXT
          );
    `);
}

//Insert a user account
function insertRow(email, password, role) {
  db.run("INSERT INTO users (email, password, role) VALUES (?, ?, ?)", [
    email,
    password,
    role,
  ]);
  console.log("Data Inserted Successfully.");
}

//Insert an email
function insertEmails(email, sender, subject, body) {
  db.run(
    "INSERT INTO emails (email, sender, subject, body) VALUES (?, ?, ?, ?)",
    [email, sender, subject, body]
  );
  console.log("Data Inserted Successfully.");
}

//Setup database
function setupdb() {
  createTables();
  insertRow("admin@gmail.com", Str_Random(32), "admin");
}

//Start database
setupdb();

//Routes
app.get("/", async function (req, res) {
  try {
    return res.render("login");
  } catch (e) {
    return res.send("Error 404");
  }
});

app.post("/", async function (req, res, next) {
  try {
    //Get supplied credentials
    let email = req.body.email;
    let password = req.body.password;

    //Check if user exist with supplied credentials
    sql = `SELECT * FROM users WHERE email= ? AND password= ?`;
    const result = await new Promise(async function (res, rej) {
      db.get(sql, [email, password], function (e, r) {
        if (e) {
          rej(e.message);
        } else {
          res(r);
        }
      });
    }).catch(function (e) {
      return res.redirect("/forbidden");
    });

    //If user exists generate JWT token and redirect them to inbox
    if (result) {
      let token_data = {
        email: result.email,
        role: result.role,
      };
      token = jwt.sign(token_data, SECRET_KEY, { expiresIn: "1h" });
      res.cookie("JWT", token);
      return res.redirect("/inbox");
    } else {
      return res.send("Invalid credentials submitted");
    }
  } catch (e) {
    return res.send("Error while performing the login process");
  }
});

app.get("/inbox", async function (req, res) {
  try {
    try {
      //Check for valid JWT token
      token = req.cookies.JWT;
      if (!token) {
        return res.redirect("/");
      }
      var data = jwt.verify(token, SECRET_KEY);
    } catch (err) {
      return res.send("Missing valid JWT token");
    }
    try {
      //Based on JWT data fetch all emails for the user
      if (data) {
        sql = `SELECT * FROM emails WHERE email = ?`;
        const result = await new Promise(async function (res, rej) {
          db.all(sql, [data.email], function (e, r) {
            if (e) {
              rej(e.message);
            } else {
              res(r);
            }
          });
        }).catch(function (e) {
          return res.redirect("/forbidden");
        });
        return res.render("inbox", { emails: result });
      } else {
        return res.send("Missing valid JWT token");
      }
    } catch (err) {
      return res.send("Missing valid JWT token");
    }
  } catch (err) {
    return res.send("Error 404");
  }
});

app.get("/register", async function (req, res) {
  try {
    return res.render("register", { is_successfull: false });
  } catch (e) {
    return res.send("Error 404");
  }
});

app.post("/register", async function (req, res, next) {
  try {
    //Get supplied credentials
    let email = req.body.email;
    let password = req.body.password;

    //Check if user already exists with supplied email
    sql = `SELECT * FROM users WHERE email= ?`;
    const result = await new Promise(async function (res, rej) {
      db.get(sql, [email], function (e, r) {
        if (e) {
          rej(e.message);
        } else {
          res(r);
        }
      });
    }).catch(function (e) {
      return res.redirect("/forbidden");
    });
    if (result) {
      return res.render("register", { is_successfull: false });
    }

    //Create new user
    insertRow(email, password, "user");
    return res.render("register", { is_successfull: true });
  } catch (e) {
    return res.send("Error while performing the registration process");
  }
});

app.post("/sendEmail", async function (req, res) {
  try {
    //Get supplied data
    authToken = req.body.AuthToken;
    email = req.body.email;
    sender = req.body.sender;
    subject = req.body.subject;
    body = req.body.body;

    //Check if supplied authentication token is valid and if it is insert Email
    if (authToken == auth_token) {
      //Check if email exists
      sql = `SELECT * FROM users WHERE email= ?`;
      const result = await new Promise(async function (res, rej) {
        db.get(sql, [email], function (e, r) {
          if (e) {
            rej(e.message);
          } else {
            res(r);
          }
        });
      }).catch(function (e) {
        return res.redirect("/forbidden");
      });
      if (result) {
        insertEmails(email, sender, subject, body);
        return res.send("Success");
      } else {
        return res.send("Error");
      }
    } else {
      return res.send("Error");
    }
  } catch (e) {
    return res.send("Error while inserting new Email");
  }
});

app.get("/forbidden", function (req, res) {
  return res.render("forbidden");
});

app.get("/logout", function (req, res) {
  res.clearCookie("JWT");
  return res.redirect("/");
});

app.get("*", function (req, res) {
  return res.redirect("/");
});

//Start App
app.listen(port, function () {
  console.log(`Serving on Port ${port}`);
});
