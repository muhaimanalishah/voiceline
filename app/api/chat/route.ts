import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, createUIMessageStreamResponse, streamText, toUIMessageStream, UIMessage } from "ai";

export async function POST(request: Request) {
    const { messages }: { messages: UIMessage[] } = await request.json();

    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
        model: openai(process.env.CHAT_MODEL ?? "gpt-4o-mini"),
        messages: modelMessages,
    });

    return createUIMessageStreamResponse({
        stream: toUIMessageStream({
            stream: result.stream,
        })
    })
};