import { ApolloClient } from 'apollo-client';
import fetch from 'whatwg-fetch';
import { HttpLink } from 'apollo-link-http';
// import { InMemoryCache } from 'apollo-cache-inmemory';
import { InMemoryCache, IntrospectionFragmentMatcher } from 'apollo-cache-inmemory';
import introspectionQueryResultData from './fragmentTypes.json';

const fragmentMatcher = new IntrospectionFragmentMatcher({
  introspectionQueryResultData,
});

const httpLinkOptions = new HttpLink({
  credentials: 'same-origin',
});


// Create the apollo client
const Client =  new ApolloClient({
  link: new HttpLink(httpLinkOptions),
  // cache: new InMemoryCache(),
  cache: new InMemoryCache({ fragmentMatcher }),
  connectToDevTools: true,
  fetch,
});

export default Client;
