import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

async function openConnection() {
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 15000,
  });
}

export async function connectDb() {
  try {
    await openConnection();
  } catch (error) {
    const servers = dns.getServers();
    const loopbackOnly = servers.length > 0 && servers.every((server) => server === '127.0.0.1' || server === '::1');
    const srvFailed = error?.syscall === 'querySrv' || error?.code === 'ECONNREFUSED';
    if (loopbackOnly && srvFailed && mongoose.connection.readyState === 0) {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      try {
        await openConnection();
        console.warn('Node DNS was loopback-only and could not resolve Atlas. Retried with public DNS.');
      } catch (retryError) {
        throw new Error(`Could not resolve MongoDB Atlas (${retryError.message}).`);
      }
    } else if (srvFailed) {
      throw new Error(
        `Could not resolve MongoDB Atlas (${error.message}). Node is using DNS servers: ${servers.join(', ') || 'none'}.`,
      );
    } else {
      throw error;
    }
  }
  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error.message);
  });
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
