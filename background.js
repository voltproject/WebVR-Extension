var extensionId = chrome.runtime.id;
log( 'Background', extensionId );

var settings = {};
var script = '';

var defaultSettings = {

	persist: true,
	share: true
}

var defaultPose = {
	position: { x: 0, y: 0, z: 0 },
	rotation: { x: 0, y: 0, z: 0, w: 1 }
};
var globalPose = {
	position: { x: 0, y: 0, z: 0 },
	rotation: { x: 0, y: 0, z: 0, w: 1 }
};
var poses = {};

loadSettings().then( res => {
	settings = res;
	settings.share = true;
	log( 'Script and settings loaded', settings );
} );

function notifyPoseToInstance( pose, tabId ) {

	var msg =  {
		action: 'pose',
		position: pose.position,
		rotation: pose.rotation
	};

	connections[ tabId ].contentScript.postMessage( msg );

	if( connections[ tabId ].devtools) {
		connections[ tabId ].devtools.postMessage( msg );
	}

}

function notifyPose( tabId ) {

	if( settings.share ) {

		Object.keys( connections ).forEach( tab => {
			notifyPoseToInstance( globalPose, tab );
		} );

	} else {

		notifyPoseToInstance( poses[ tabId ], tabId );

	}

}

var connections = {};

chrome.runtime.onConnect.addListener( function( port ) {

	log( 'New connection (chrome.runtime.onConnect) from', port.name, port.sender.frameId, port );

	var name = port.name;

	function listener( msg, sender, reply ) {

		var tabId;

		if( msg.tabId ) tabId = msg.tabId
		else tabId = sender.sender.tab.id;

		if( !connections[ tabId ] ) connections[ tabId ] = {};
		connections[ tabId ][ name ] = port;

		if( !poses[ tabId ] ) {
			poses[ tabId ] = defaultPose;
		}

		if( name === 'panel' ) {
			switch( msg.action ) {
				case 'pose':
				globalPose.position = msg.position;
				globalPose.rotation = msg.rotation;
				poses[ tabId ] = {
					position: msg.position,
					rotation: msg.rotation
				};
				notifyPose( tabId );
				break;
			}
		}

		if( name === 'contentScript' ) {
			if( msg.action === 'page-ready' ) {
				notifyPose( tabId );
			}
		}

		if( msg.action === 'reset-pose' ) {
			globalPose.position = defaultPose.position;
			globalPose.rotation = defaultPose.rotation;
			poses[ tabId ] = defaultPose;
			notifyPose( tabId );
		}

		log( 'port.onMessage', port.name, msg );

	}

	port.onMessage.addListener( listener );

	port.onDisconnect.addListener( function() {

		port.onMessage.removeListener( listener );

		log( name, 'disconnect (chrome.runtime.onDisconnect)' );

		Object.keys( connections ).forEach( c => {
			if( connections[ c ][ name ] === port ) {
				connections[ c ][ name ] = null;
				delete connections[ c ][ name ];
			}
			if ( Object.keys( connections[ c ] ).length === 0 ) {
				connections[ c ] = null;
				delete connections[ c ];
			}
		} )


	} );

	port.postMessage( { action: 'ack' } );

	return true;

});
