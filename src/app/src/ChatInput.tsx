import React, { FC } from "react";
import { Input } from "antd";
import { Configuration, OpenAIApi } from "openai";
import { debounce } from "lodash";

const baseQuery = ``;

const configuration = new Configuration({
  apiKey: "",
});

const openai = new OpenAIApi(configuration);

async function generateCode(prompt: string): Promise<string | undefined> {
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-002",
      prompt: prompt,
      max_tokens: 2000,
      n: 1,
      stop: null,
      temperature: 0.8,
      top_p: 1,
    });

    if (response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].text;
    } else {
      console.log("No code generated.");
    }
  } catch (error) {
    console.error("Error generating code:", error);
  }
  return undefined;
}

type ChatInputProps = {
  codeReady: (input: string) => Promise<void>;
};

const ChatInput: FC<ChatInputProps> = ({ codeReady }) => {
  const onChange = debounce((event: any) => {
    const query = baseQuery + event.target.value;
    generateCode(query).then(code => {
      code = code?.substring(code.indexOf("\n"))
      if (code) {
        console.log(code);
        codeReady(code);
      }
    });
  }, 300);

  return <Input placeholder="Ask the AI..." onChange={onChange} />;
};

export default ChatInput;
