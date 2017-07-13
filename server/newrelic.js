'use strict'

/**
 * New Relic agent configuration.
 *
 * See lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
var nr_settings = {};

var node_env = process.env.NODE_ENV || 'development';
if(node_env !== 'development') {
    nr_settings.licenseKey = JSON.parse(process.env.VCAP_SERVICES)['predixplatform-newrelic'][0].credentials.licenseKey;
    nr_settings.application_name = JSON.parse(process.env.VCAP_APPLICATION)['application_name'];
    console.log("newrelic in use; app name: " + nr_settings.application_name);
    console.log("newrelic in use; licenseKey: " + nr_settings.licenseKey);
}

exports.config = {
  /**
   * Array of application names.
   */
  app_name: [nr_settings.application_name],
  /**
   * Your New Relic license key.
   */
  license_key: nr_settings.licenseKey,

  proxy: nr_settings.http_proxy,

  logging: {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level: 'info'
  }
}
