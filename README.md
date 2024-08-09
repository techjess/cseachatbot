# AI-Powered Chat Application

An intelligent chat application powered by advanced language models, featuring real-time communication, conversation management, and contextual responses.

## Features

- User authentication with Google SSO
- Real-time messaging using WebSockets
- AI-powered responses using OpenAI and Anthropic models
- Conversation management (create, rename, delete)
- Context-aware responses
- Responsive design for desktop and mobile

## Tech Stack

- Frontend: Next.js, React, TypeScript
- Backend: FastAPI, Python
- Database: PostgreSQL
- ORM: Prisma
- Authentication: NextAuth.js
- AI Integration: LangChain
- Real-time Communication: WebSockets
- Styling: Tailwind CSS

## Prerequisites

- Node.js (v14 or later)
- Python (v3.8 or later)
- PostgreSQL
- OpenAI API key
- Anthropic API key (optional)

## Setup

1. Clone the repository:
2. Install frontend dependencies:
3. Install backend dependencies:

4. Set up environment variables:
- Create a `.env` file in the root directory
- Add the following variables:
  ```
  DATABASE_URL=your_postgresql_connection_string
  NEXTAUTH_SECRET=your_nextauth_secret
  GOOGLE_CLIENT_ID=your_google_client_id
  GOOGLE_CLIENT_SECRET=your_google_client_secret
  OPENAI_API_KEY=your_openai_api_key
  ANTHROPIC_API_KEY=your_anthropic_api_key
  ```

5. Set up the database:
  npx prisma db push
6. Start the development servers:
- Frontend:
  ```
  npm run dev
  ```
- Backend:
  ```
  uvicorn app:app --reload
  ```

7. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Sign in using your Google account
2. Start a new conversation or select an existing one
3. Type your message and receive AI-powered responses
4. Manage your conversations using the sidebar

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- OpenAI for their powerful language models
- Anthropic for their advanced AI capabilities
- The LangChain community for their excellent tools and documentation

