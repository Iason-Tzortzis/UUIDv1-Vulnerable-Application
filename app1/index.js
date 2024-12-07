//Dependencies
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const ejsMate = require("ejs-mate");
const uuid = require("node-uuid");
const axios = require("axios");
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

const port = process.env.PORT1 || 8000;
const SECRET_KEY = String(Str_Random(32));
const auth_token = process.env.AUTH_TOKEN;

//Load flag
const flag = (function (flag_path) {
  if (fs.existsSync(flag_path)) {
    return fs.readFileSync(path.join(__dirname, "flag"), "utf8").trim();
  } else {
    return "FLAG{example-flag-for-testing}";
  }
})(path.join(__dirname, "flag"));

// Declare database
const db = new sqlite3.Database(
  path.join(__dirname, "uuid-vulnerable-app-1.db"),
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
            username TEXT,
            password TEXT,
            role TEXT
        );

        DROP TABLE IF EXISTS resetTokens;
        CREATE TABLE resetTokens
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resetToken TEXT,
            username TEXT
        );
  `);
}

//Insert a user account
function insertRow(email, username, password, role) {
  db.run(
    "INSERT INTO users (email, username, password, role) VALUES (?, ?, ?, ?)",
    [email, username, password, role]
  );
  console.log("Data Inserted Successfully.");
}

//Insert a resetToken
function insertToken(resetToken, username) {
  db.run("INSERT INTO resetTokens (resetToken, username) VALUES (?, ?)", [
    resetToken,
    username,
  ]);
  console.log("Reset token:" + resetToken + "for username:" + username);
}

//Delete resetTokens based on supplied username
function deleteResetTokens(username) {
  db.run("DELETE FROM resetTokens WHERE username= ?", [username]);
  console.log("Data Deleted Successfully.");
}

//Setup database
function setupdb() {
  createTables();
  insertRow("angel.mendoza@gmail.com", "Angel_Mendoza", Str_Random(16), "user");
  insertRow(
    "theodore.alletez@gmail.com",
    "Theodore_Alletez",
    Str_Random(16),
    "user"
  );
  insertRow("lucal.allen@gmail.com", "Lucas_Allen", Str_Random(16), "user");
  insertRow("admin@gmail.com", "Administrator", Str_Random(32), "admin");
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
    //Get credentials from request body
    let username = req.body.username;
    let password = req.body.password;

    //Lookup if user exists with the supplied credentials
    sql = `SELECT * FROM users WHERE username= ? AND password= ?`;
    const result = await new Promise(async function (res, rej) {
      db.get(sql, [username, password], function (e, r) {
        if (e) {
          rej(e.message);
        } else {
          res(r);
        }
      });
    }).catch(function (e) {
      return res.redirect("/forbidden");
    });

    //If a result is returned generate JWT token
    if (result) {
      let token_data = {
        username: result.username,
        email: result.email,
        role: result.role,
      };
      token = jwt.sign(token_data, SECRET_KEY, { expiresIn: "1h" });
      res.cookie("JWT", token);
      return res.redirect("/home");

      //If there is not result returned send error
    } else {
      return res.send("Invalid credentials submitted");
    }
  } catch (e) {
    return res.send("Error while performing the login process");
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
    //Get supplied input to create user account
    let email = req.body.email;
    let username = req.body.username;
    let password = req.body.password;

    //Check if user already exists with supplied username
    sql = `SELECT * FROM users WHERE username= ?`;
    const result1 = await new Promise(async function (res, rej) {
      db.get(sql, [username], function (e, r) {
        if (e) {
          rej(e.message);
        } else {
          res(r);
        }
      });
    }).catch(function (e) {
      return res.redirect("/forbidden");
    });
    if (result1) {
      return res.render("register", { is_successfull: false });
    }
    //Check if user already exists with supplied email
    sql = `SELECT * FROM users WHERE email= ?`;
    const result2 = await new Promise(async function (res, rej) {
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
    if (result2) {
      return res.render("register", { is_successfull: false });
    }

    //Insert new account
    insertRow(email, username, password, "user");
    return res.render("register", { is_successfull: true });
  } catch (e) {
    return res.send("Error while performing the registering process");
  }
});

app.get("/home", function (req, res) {
  try {
    //Check for valid JWT token
    try {
      token = req.cookies.JWT;
      if (!token) {
        return res.redirect("/");
      }
      var data = jwt.verify(token, SECRET_KEY);
    } catch (err) {
      return res.send("Missing valid JWT token");
    }
    //if token is valid render home page
    if (data) {
      return res.render("home", { username: data.username });
    } else {
      return res.send("Missing valid JWT token");
    }
  } catch (err) {
    return res.send("Error 404");
  }
});

app.get("/admin", async function (req, res) {
  try {
    //Check for valid JWT token
    try {
      token = req.cookies.JWT;
      if (!token) {
        return res.redirect("/");
      }
      var data = jwt.verify(token, SECRET_KEY);
    } catch (err) {
      return res.send("Missing valid JWT token");
    }
    //If users role is admin render admin panel
    if (data.role == "admin") {
      return res.render("admin", { flag: flag });
    } else {
      return res.render("forbidden");
    }
  } catch (err) {
    return res.send("Missing valid JWT token");
  }
});

app.get("/forgot-password", async function (req, res) {
  try {
    return res.render("forgot-password", { is_successfull: false });
  } catch (e) {
    return res.send("Error 404");
  }
});

app.post("/forgot-password", async function (req, res) {
  try {
    //Get provided username
    let username = req.body.username;

    //Generate resetToken
    let resetToken = uuid.v1();

    //Get user account based on username and check if username exists
    sql = `SELECT * FROM users WHERE username = ?`;
    const result = await new Promise(async function (res, rej) {
      db.get(sql, username, function (e, r) {
        if (e) {
          rej(e.message);
        } else {
          res(r);
        }
      });
    }).catch(function (e) {
      return res.redirect("/forbidden");
    });

    if (!result) {
      return res.render("forgot-password", { is_successfull: false });
    }

    //Insert resetToken in the database
    insertToken(resetToken, username);

    //Send email to user with the resetToken
    const response = await axios.post(
      "http://uuidv1-vulnerable-application-app-1:8001/sendEmail",
      {
        AuthToken: auth_token,
        email: result.email,
        sender: "System",
        subject: "Reset link for your account",
        body: `Here is your password reset link: <a id="reset-password-link" href="/reset-password/${resetToken}">/reset-password/${resetToken}</a>`,
      }
    );

    //If email is sent successfully render success page
    if (response.data == "Success") {
      return res.render("forgot-password", { is_successfull: true });
    } else {
      return res.send("Email supplied does not exist");
    }
  } catch (e) {
    return res.send("Error while performing the forgot password process");
  }
});

app.get("/reset-password/:resetToken", async function (req, res) {
  try {
    //Get resetToken from request parameters
    resetToken = req.params.resetToken;

    //Check if resetToken is valid
    sql = `SELECT * FROM resetTokens WHERE resetToken = ?`;
    const result = await new Promise(async function (res, rej) {
      db.get(sql, resetToken, function (e, r) {
        if (e) {
          rej(e.message);
        } else {
          res(r);
        }
      });
    }).catch(function (e) {
      return res.redirect("/forbidden");
    });

    //If resetToken is valid render reset-password page with the resetToken assigned as a cookie
    if (result) {
      res.cookie("resetToken", resetToken);
      return res.render("reset-password", { username: result.username });
    } else {
      return res.redirect("/forbidden");
    }
  } catch (e) {
    return res.send("Error 404");
  }
});

app.post("/reset-password", async function (req, res) {
  try {
    //Get resetToken from the cookies
    resetToken = req.cookies.resetToken;

    //Get the supplied new password
    newPassword = req.body.newPassword;

    //Get user account data based on the resetToken
    sql = `SELECT * FROM resetTokens WHERE resetToken = ?`;
    const result1 = await new Promise(async function (res, rej) {
      db.get(sql, resetToken, function (e, r) {
        if (e) {
          rej(e.message);
        } else {
          res(r);
        }
      });
    }).catch(function (e) {
      return res.redirect("/forbidden");
    });

    //update user data with the new supplid password
    if (result1) {
      sql = `UPDATE users SET password = ? WHERE username = ?`;
      const result2 = await new Promise(async function (res, rej) {
        db.get(sql, [newPassword, result1.username], function (e, r) {
          if (e) {
            rej(e.message);
          } else {
            res(r);
          }
        });
      }).catch(function (e) {
        return res.redirect("/forbidden");
      });

      //Delete all resetTokens associated with user account
      deleteResetTokens(result1.username);

      //Clear the resetToken cookie and redirect to success page
      res.clearCookie("resetToken");
      return res.redirect("/reset-success");
    } else {
      return res.redirect("/forbidden");
    }
  } catch (e) {
    return res.send("Error 404");
  }
});

app.get("/reset-success", function (req, res) {
  return res.render("reset-success");
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
