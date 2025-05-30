import '../styles/globals.css';
import { AuthProvider } from '../context/AuthContext';
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <title>Stealth AI Ops Assistant</title>
        <meta name="description" content="A private, mobile-first AI assistant that helps solo founders monitor Slack, Zendesk, and Harvest" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp;