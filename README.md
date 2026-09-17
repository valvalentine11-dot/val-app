# Social Media REST API

This project is a REST API for a social media platform. It handles the main features you would expect from a basic social app, including user accounts, posts, follows, likes, direct messages, and a personalized feed.

Authentication is handled with JWT, while MongoDB is used for storing application data.

## Tech Stack

* Node.js + Express
* MongoDB + Mongoose
* JWT (`jsonwebtoken`) for authentication

  * Tokens expire after **1 hour**
* `bcryptjs` for securely hashing passwords
* Jest + Supertest for API testing
* `mongodb-memory-server` for running tests without a local MongoDB database

## Getting Started

Clone the repository and install the dependencies:

```bash
git clone <your-repo-url>

cd social-media-api

cp .env.example .env
```

Open the `.env` file and add your MongoDB connection string and JWT secret.

Then install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The API will be available at:

```text
http://localhost:5000
```

## Demo UIs

There are two simple interfaces included with the project for testing the API.

**Feed**

```text
http://localhost:5000/
```

From here you can create an account, create posts, like posts, and browse the public feed.

**Messages**

```text
http://localhost:5000/chat.html
```

This page can be used to send and receive direct messages.

## Running Tests

Run the test suite with:

```bash
npm test
```

The tests use `mongodb-memory-server`, so you don't need to have MongoDB installed locally.

The first run may need internet access because `mongodb-memory-server` downloads the MongoDB binary. After that, the tests can use the downloaded binary.

The same tests also run automatically through the GitHub Actions workflow in:

```text
.github/workflows/test.yml
```

The workflow runs whenever changes are pushed to the repository.

## Data Model

### User

Stores the basic information for each user:

* `first_name`
* `last_name`
* `username`
* `email`
* `password` (hashed)
* `bio`
* `followers_count`
* `following_count`

### Post

A post contains:

* `title`
* `content`
* `author` (reference to User)
* `tags[]`
* `state` (`draft` or `published`)
* `like_count`
* `comment_count`
* `createdAt`

New posts are created as drafts and can later be published by their owner.

### Follow

Follows are stored separately from the User document:

* `follower` (reference to User)
* `following` (reference to User)

A unique compound index prevents the same user from following another user more than once.

### Like

Likes are also stored in their own collection:

* `user` (reference to User)
* `post` (reference to Post)

A unique compound index prevents duplicate likes.

### Message

Messages contain:

* `sender` (reference to User)
* `receiver` (reference to User)
* `text`
* `read`
* `createdAt`

The collection is indexed to make looking up conversations faster.

## Authentication

Protected endpoints require a JWT in the request header:

```text
Authorization: Bearer <token>
```

A token is returned when a user signs up or logs in. Tokens expire after one hour by default, although this can be changed with the `JWT_EXPIRES_IN` environment variable.

### Auth Endpoints

| Method | Route              | Auth     | Description                                    |
| ------ | ------------------ | -------- | ---------------------------------------------- |
| POST   | `/api/auth/signup` | –        | Create an account and return `{ user, token }` |
| POST   | `/api/auth/login`  | –        | Log in using an email or username and password |
| GET    | `/api/auth/me`     | Required | Get the currently logged-in user's profile     |

For login, the request body looks like:

```json
{
  "identifier": "email-or-username",
  "password": "your-password"
}
```

## Posts

| Method | Route                    | Auth             | Description                      |
| ------ | ------------------------ | ---------------- | -------------------------------- |
| GET    | `/api/posts`             | Optional         | Get published posts              |
| GET    | `/api/posts/:id`         | Optional         | Get a single published post      |
| GET    | `/api/posts/me`          | Required         | Get the logged-in user's posts   |
| GET    | `/api/posts/feed`        | Required         | Get the user's personalized feed |
| POST   | `/api/posts`             | Required         | Create a new draft               |
| PATCH  | `/api/posts/:id`         | Required (Owner) | Edit a post                      |
| PATCH  | `/api/posts/:id/publish` | Required (Owner) | Publish a draft                  |
| DELETE | `/api/posts/:id`         | Required (Owner) | Delete a post                    |
| POST   | `/api/posts/:id/like`    | Required         | Like a published post            |
| DELETE | `/api/posts/:id/like`    | Required         | Unlike a post                    |

### Listing and Searching Posts

The public posts endpoint supports pagination:

```text
GET /api/posts?page=1&limit=20
```

You can also search by title, tags, or the author's username:

```text
GET /api/posts?search=javascript
```

Sorting is supported as well:

```text
GET /api/posts?sort=-like_count,-timestamp
```

Available sort fields are:

* `like_count`
* `comment_count`
* `timestamp`

Add `-` before a field to sort it in descending order.

The `/api/posts/me` endpoint can also be filtered by state:

```text
GET /api/posts/me?state=draft
```

or:

```text
GET /api/posts/me?state=published
```

## Users and Follows

| Method | Route                      | Auth     | Description                       |
| ------ | -------------------------- | -------- | --------------------------------- |
| GET    | `/api/users/:id`           | –        | Get a public user profile         |
| GET    | `/api/users/:id/following` | –        | Get the users this person follows |
| GET    | `/api/users/:id/followers` | –        | Get this user's followers         |
| POST   | `/api/users/:id/follow`    | Required | Follow a user                     |
| DELETE | `/api/users/:id/follow`    | Required | Unfollow a user                   |

A user cannot follow themselves. Trying to follow the same person twice returns a `409` response.

The following and followers endpoints support pagination.

## Messages / Chat

| Method | Route                | Auth     | Description                             |
| ------ | -------------------- | -------- | --------------------------------------- |
| GET    | `/api/chat`          | Required | Get the user's conversations            |
| GET    | `/api/chat/:id`      | Required | Get a conversation with a specific user |
| POST   | `/api/chat/:id/send` | Required | Send a message                          |

To send a message, provide the message text in the request body:

```json
{
  "text": "Hey, how are you?"
}
```

Opening a conversation marks the messages in that conversation as read.

The conversation list includes the latest message, its timestamp, and the number of unread messages.

## Pagination

All paginated list endpoints use the same response format:

```json
{
  "data": [],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "total_pages": 3,
    "has_next_page": true,
    "has_prev_page": false
  }
}
```

This keeps pagination consistent across posts, followers, following lists, and conversations.

## Design Notes

### Follows and Likes

Follows and likes are kept in separate collections rather than being stored as arrays inside the User or Post documents.

Both collections use unique compound indexes. This means the database itself prevents duplicate follows and likes, including cases where two requests happen at almost the same time.

### Draft Posts

New posts start as drafts.

Drafts aren't visible to other users. Only the owner can access their own drafts, including through the single-post endpoint.

### Optional Authentication

Public post routes use an `optionalAuth` middleware.

This means authentication isn't required to browse public posts, but users who are logged in can still get additional information. For example, the API can indicate whether the current user has already liked a post.

It also allows the API to show a user's own drafts when appropriate.

### Search

Post searches check the title, tags, and author's username together, so a single search request can match any of these fields.

## Deployment

The API can be deployed to most Node.js hosting platforms that support a MongoDB connection.

Some possible options include Render, Railway, Fly.io, or a traditional server running Node.js with PM2 and Nginx.

Before starting the application in production, make sure these environment variables are configured:

```text
MONGO_URI
JWT_SECRET
JWT_EXPIRES_IN
```

Then install the dependencies and start the application:

```bash
npm install
npm start
```
