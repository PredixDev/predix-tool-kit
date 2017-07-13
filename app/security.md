#### Login as Admin
Enter the admin secret you created earlier, when you ran this command: `cf create-service predix-uaa`.

After logging in, you'll get an Admin Token, which will be used to configure your instance of UAA.

#### Create Client ID
A Client ID is used by an Application to make client/server requests to Services in the cloud.  Apps usually only need a single Client ID.  *Do not share your Client ID with your users.*
Enter the name of the new client id for your application, e.g. "my-app-clientid".
In this utility, we do see the Client ID in the browser, but this is not recommended in a production application.  Client ID should be kept on the server.

#### Create User
Users of your application will enter this username and password to access your application.  Later we can add this user to groups, which can be used to give access to Predix services.

#### Login as User
This is a demonstration of logging as your new user, with the grant type of "password".  In production, you should probably use grant type "authorization_code".  Also, the client ID and secret should only be stored on the server, not displayed in the browser.

#### User Authcode Login
This is a demonstration of logging as your new user, with the grant type of "authorization_code".  This is the most secure application architecture.  The client ID should be for purposes of AuthCode Login, with limited authorities, not one that has privileges to back end services.

The user's browser is redirected to the UAA Login page so that even the Application is unaware of the user's password.  An AuthCode is returned and sent as a query parameter to the redirect url within your application.  Your application will receive the authcode and retrieve a userToken from UAA.   Ideally, at this point, you're application will use info from the User token (see openid) to send requests to ACS policies to control what the user sees.

Notice the user token returned has the scopes of the ClientId that match the user groups that the user is a member of. For this reason, we recommend your application use a login_client_id which has limited authority and an app_client_id which has authority to access Predix services.

Also notice that the redirect_uri in both requests is very important, they need to match in order for UAA to return the token.  And notice that the Authcode returned is only valid once, subsequent requests to retrieve the token, using the authcode return an Invalid authorization code response.

#### User Authcode Token
This is a demonstration of getting a user token, with the grant type of "authorization_code".  This is the most secure application architecture.  The client ID should be for purposes of AuthCode Login, with limited authorities, not one that has privileges to back end services. The user's browser is redirected to the UAA Login page so that even the Application is unaware of the user's password.  An AuthCode is returned and sent as a query parameter to the redirect url within your application.  Your application will receive the authcode and retrieve a userToken from UAA.   Ideally, at this point, you're application will use info from the User token (see openid) to send requests to ACS policies to control what the user sees.

#### Check Token
The token is a JSON Web Token (JWT), which is an industry standard.  Learn more about JWT at <a href="http://jwt.io" target="\_blank">jwt.io.</a>  The check_token REST API can be used by your front end UI Application, or back end microservice to ensure that the user has a valid token.

#### Create Group
Groups can be used to manage access to resources.  In Predix UAA, group names can be created with names that match scopes.  The scopes match Predix-Zone-Ids to manage access to Predix platform services.  After creating a Predix service such as Timeseries or Asset, you'll want to create a group to match.

#### Add User to Group
Different users might have access to different services.  By adding users to groups, you can manage this access at a high level.  To access Predix services, your group names should match the authorities described in the Update Client section.

This process actually requires three REST API calls:
1. Get group by name
2. Get user by name
3. Add user to group

#### Get Client
Before we make the call to modify a client, it's important to get all the current client info.  Then we'll only change what we need to change.

#### Update Client
In Predix cloud, you'll need to add authorities to your client in order to access Predix services.  Below is a list of authorities used for Predix services.  Service instance GUID is used as Predix-Zone-Id.  You can find the GUID by running this command:

`cf service my-service-instance --guid`

**Predix service authorities**
* Access Control
  * acs.policies.read
  * acs.policies.write
  * acs.attributes.read
  * acs.attributes.write
  * predix-acs.zones.&lt;acs_instance_guid&gt;.user
* Analytics Catalog
  * analytics.zones.&lt;service_instance_guid&gt;.user
* Analytics Runtime
  * analytics.zones.&lt;service_instance_guid&gt;.user
* Asset
  * predix-asset.zones.&lt;service_instance_guid&gt;.user
* Tenant Management
  * tms.tenant.read
  * tms.tenant.write
  * predix-tms.zones.&lt;tms_instance_guid&gt;.user
* Time Series
  * Data Ingestion
    * timeseries.zones.&lt;Predix-Zone-Id&gt;.user
    * timeseries.zones.&lt;Predix-Zone-Id&gt;.ingest
  * Data Queries
    * timeseries.zones.&lt;Predix-Zone-Id&gt;.user
    * timeseries.zones.&lt;Predix-Zone-Id&gt;.query
* View
  * views.zones.&lt;service_instance_guid&gt;.user
  * views.admin.user
  * views.power.user


### Login as Client
This is a demonstration of logging as a client , with the grant type of "client_credentials". Token generated by this call is used to call Predix Industrial Services.
