# Mobile-Friendly Application For Rex

We made extensive use of **VoiceFlow** and **Mappedin**. This provided a significant challenge since these services could not efficiently be run on a Raspberry Pi, so we created a mobile-friendly web application that takes care of human-computer interaction (text to speech, speech to text) as well as making API requests.

We used a custom knowledge base on VoiceFlow to customize the agent to be very specific to the different rooms in E7 and point of interests at Hack the North. We used VoiceFlow's Supabase integration to log a request in the database to begin a trip in the database (that the Raspberry Pi picks up on). Through the app, we made calls to VoiceFlow's API to progress the user's conversation with the agent.

For Mappedin, we rendered the map on a React Typescript application and made use of the Wayfinding endpoint to retrieve thorough directions. Not only are these directions displayed on the app, but they are sent to the Supabase database which the Raspberry Pi listens to for entries to trigger certain movements.

Supabase was used to connect the Raspberry Pi, VoiceFlow Agent, and Mappedin wayfinding. We chose Supabase due to its realtime subscription abilities and also its compatibility with all three ends of Rex.
