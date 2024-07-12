# d1driver

A lightweight TypeScript wrapper providing a simple interface to interact with SQLite D1 databases within workerd runtime intended for prototyping. Reducing SQL boilerplate to get, create, update, and remove functions. Not interfering with sqlite functionality.

# Installation
```npm npm install @simultsop/d1driver```

# Usage
```node 

import { get, create, update } from '@simultsop/d1driver'

interface Env {
	KV: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { results: posts } = await get(
    context.env.DB,
    "blog"
  );

  if(posts.length===0)
    new Response("no blog post found", { status: 404 });

  return Response.json(posts);
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const blogFormData = await context.request.formData();
  const newBlogPost = {
    title: formData.get('title'),
    content: formData.get('content'),
    image: formData.get('imageUrl'),
    createdAt: new Date() // or if you set current timestamp on schema do not provide createdAt at all
  }

  const { success, results } = await create(
      context.env.DB,
      "blog", 
      newBlogPost
  );

  if( success !== true ) {
    return new Response("something went wrong", {
      status: 500,
    });
  }

  return Response.json( results.shift() )
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const blogFormData = await context.request.formData();

  const conditions = { id: blogFormData.get('id') }
  const blogPostUpdates = {
    title: formData.get('update-title'),
    content: formData.get('update-content'),
    image: formData.get('update-imageUrl'),
    updatedAt: new Date() // or if you set current timestamp on schema do not provide updatedAt at all
  }

  const { success, results } = await update(
      context.env.DB,
      "blog", 
      blogPostUpdates,
      conditions
  );

  if( success !== true ) {
    return new Response("something went wrong", {
      status: 500,
    });
  }

  return Response.json( results.shift() )
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const blogFormData = await context.request.formData();

  const conditions = { id: blogFormData.get('id') }

  const { success } = await remove(
      context.env.DB,
      "blog", 
      conditions
  );

  if( success !== true ) {
    return new Response("something went wrong", {
      status: 500,
    });
  }

  return new Response("successfully deleted blog post with id:" + conditions.id, {
    status: 200,
  });
}
```

# What this wrapper doesn't do
It doesn't create migrations or prepare schema for your database. Also does not perform validation or any type of sanitization to parameters. Check out the single file source for more clarity.
