const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const convertTweetDbObjectToResponseObject = (dbObject) => {};

//API 1

const validatePassword = (password) => {
  return password.length > 6;
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    const createUserQuery = `
     INSERT INTO
      user (name,username,password,gender)
     VALUES
      (
       '${name}',
       '${username}',
       '${hashedPassword}',
       '${gender}'
      );`;
    if (validatePassword(password)) {
      await database.run(createUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authentication with JWT Token

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getFollowingUsers = `
   SELECT following_user_id
    FROM follower;
    `;
  const followingUserDb = await database.all(getFollowingUsers);
  //response.send(followingUsersDb);
  const getFollowingDetails = `
  SELECT username,tweet,date_time FROM tweet INNER JOIN user ON tweet.user_id=user.user_id
  WHERE tweet.user_id=${followingUserDb.following_user_id};`;
  const result = await database.all(getFollowingDetails);
  response.send(result);
});

//API 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const getNames = `
     SELECT follower_id
    FROM follower;
    `;
  const getNamesDb = await database.all(getNames);
  const getNamesDetails = `
  SELECT name FROM user WHERE user_id = ${getNamesDb.follower_id};
  `;
  result = await database.all(getNamesDetails);
  response.send(result);
  //response.send(getNamesDb);
});

//API 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const getNames = `
     SELECT follower_id
    FROM follower;
    `;
  const getNamesDb = await database.all(getNames);
  const getNamesDetails = `
  SELECT name FROM user WHERE user_id = ${getNamesDb.follower_id};
  `;
  result = await database.all(getNamesDetails);
  response.send(result);
  //response.send(getNamesDb);
});

//API 6

app.get("/tweets/:tweetId/", async (request, response) => {
  const { tweetId } = request.params;
  const getTweetQuery = `
    SELECT 
      *
    FROM 
      tweet
    WHERE 
      tweet_id = ${tweetId};`;
  const tweet = await database.get(getTweetQuery);
  response.send(convertTweetDbObjectToResponseObject(tweet));
});

//API 10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const postTweetQuery = `
  INSERT INTO
       tweet (tweet)
  VALUES
    (${tweet});`;
  await database.run(postTweetQuery);
  response.send("Created a Tweet");
});

//API 11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const deleteTweetQuery = `
  DELETE FROM
    tweet
  WHERE
    tweet_id = ${tweetId} 
  `;
    await database.run(deleteTweetQuery);
    response.send("Tweet Removed");
  }
);

module.exports = app;
