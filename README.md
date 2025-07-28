# Task Scheduler API

## Requirements

Use NodeJS version v20 or more recent versions.

## Setup

1. `npm install`
2. Create `.env` and fill all the values (see `env.example`)
3. `npm run start:dev`
4. Go to `http://localhost:3000/api/docs` for documentation

## API Examples

### Register

```bash
curl --request POST \
  --url http://localhost:3000/api/auth/register \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/11.3.0' \
  --data '{
  "email": "test@example.com",
  "password": "test1234",
  "firstName": "Hello",
  "lastName": "World"
}'
```

### Login

```bash
curl --request POST \
  --url http://localhost:3000/api/auth/login \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/11.3.0' \
  --data '{
  "email": "test@example.com",
  "password": "test1234"
}'
```

### Create Task (Regular)

```bash
curl --request POST \
  --url http://localhost:3000/api/tasks \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTc1MzY5OTU4MSwiZXhwIjoxNzUzNzg1OTgxfQ.2gN-JYlH3_LAYV6J7epyHH4AAKPq-8nxdfit5xZETNc' \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/11.3.0' \
  --data '{
  "title": "Task 1",
  "description": "This is a test task created for testing scheduled notifications",
  "scheduledTime": "2025-07-28T10:56:00.000Z"
}'
```

### Create Task (Recurring)

```bash
curl --request POST \
  --url http://localhost:3000/api/tasks \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTc1MzcwMDkyOCwiZXhwIjoxNzUzNzg3MzI4fQ.yQcj9Hl0hVqkXpdHcUXY1ZVTwjJvHhmAwpN158uO9R8' \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/11.3.0' \
  --data '{
	"title": "Recurring Task 1",
	"description": "This is a test task created for testing scheduled notifications",
	"scheduledTime": "2025-07-28T10:28:00.000Z",
	"recurrencePattern": "daily",
	"recurrenceInterval": 1
}'
```

### Create A Child Task

```bash
curl --request POST \
  --url http://localhost:3000/api/tasks \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTc1MzY5OTU4MSwiZXhwIjoxNzUzNzg1OTgxfQ.2gN-JYlH3_LAYV6J7epyHH4AAKPq-8nxdfit5xZETNc' \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/11.3.0' \
  --data '{
	"title": "Child Task 1",
	"description": "This is a test task created for testing scheduled notifications",
	"scheduledTime": "2025-07-29T15:27:00.000Z",
	"parentTaskId": 1
}'
```


### Complete Task

```bash
curl --request PATCH \
  --url http://localhost:3000/api/tasks/85/complete \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImVtYWlsIjoidXNlcjNAZXhhbXBsZS5jb20iLCJpYXQiOjE3NTM2OTc4MjUsImV4cCI6MTc1Mzc4NDIyNX0.IiNlRN_MsTmvdI_iK7UKmpiqnzqTn0-wketCkFjiMtY' \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/11.3.0'
```

### Get Tasks

```bash
curl --request GET \
  --url http://localhost:3000/api/tasks \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTc1MzcwMDkyOCwiZXhwIjoxNzUzNzg3MzI4fQ.yQcj9Hl0hVqkXpdHcUXY1ZVTwjJvHhmAwpN158uO9R8' \
  --header 'User-Agent: insomnia/11.3.0'
```

### Get Notifications

```bash
curl --request GET \
  --url http://localhost:3000/api/notifications \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTc1MzcwMDkyOCwiZXhwIjoxNzUzNzg3MzI4fQ.yQcj9Hl0hVqkXpdHcUXY1ZVTwjJvHhmAwpN158uO9R8' \
  --header 'User-Agent: insomnia/11.3.0'
```


