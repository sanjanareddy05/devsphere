import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

export interface Message {
  _id?: ObjectId;
  channelId: string;
  workspaceId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  createdAt: Date;
  editedAt?: Date;
  reactions?: Record<string, string[]>; // emoji -> userIds
}

let db: Db;

export async function connectMongo(): Promise<Db> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/devsphere';
  const client = new MongoClient(uri);
  await client.connect();
  db = client.db();

  // Create indexes for efficient queries
  const messages = db.collection<Message>('messages');
  await messages.createIndex({ channelId: 1, createdAt: -1 });
  await messages.createIndex({ workspaceId: 1 });

  console.log('[chat-service] MongoDB connected ✓');
  return db;
}

export function getMessages(): Collection<Message> {
  return db.collection<Message>('messages');
}
