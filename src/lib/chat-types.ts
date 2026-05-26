export interface ChatMessage {
  id: string;
  sender: string;         // e.g. "Ты", "Маньяк", "Мама"
  text: string;           // Message text content
  typingDelayMs: number;  // Suspension delay for typing animation (e.g. 1500)
  isCliffhanger?: boolean; // If true, halts tap progress and opens paywall
}

export interface ChatEpisode {
  id: string;
  userId: string;
  showId?: string;
  title: string;
  prompt: string;
  status: 'pending' | 'ready' | 'failed';
  messages: ChatMessage[];
  createdAt: string;
  unlockedTillIndex: number; // Index of last message the user is allowed to read
}

export function validateChatMessage(msg: any): ChatMessage {
  if (
    typeof msg !== 'object' ||
    msg === null ||
    typeof msg.id !== 'string' ||
    typeof msg.sender !== 'string' ||
    typeof msg.text !== 'string' ||
    typeof msg.typingDelayMs !== 'number'
  ) {
    throw new Error('Invalid message format');
  }
  return msg as ChatMessage;
}
