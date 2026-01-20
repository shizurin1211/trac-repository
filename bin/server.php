<?php
use Dotenv\Dotenv;

use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

use React\EventLoop\Factory as LoopFactory;

use App\Services\AsyncDatabaseService;
use App\Services\DeviceMonitorService;

require __DIR__ . '/../vendor/autoload.php';
$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

date_default_timezone_set('America/Caracas');

$loop = LoopFactory::create();

$asyncDbService = new AsyncDatabaseService($loop, [
    $_ENV['DB_USERNAME'], $_ENV['DB_PASSWORD'], $_ENV['DB_HOST'], $_ENV['DB_DATABASE']
]);
$monitorService = new DeviceMonitorService($loop, $asyncDbService); 

$server = new IoServer(
    new HttpServer(
        new WsServer($monitorService)
    ),
    new \React\Socket\Server('0.0.0.0:8080', $loop),
    $loop
);

echo "SISTEMA DE MONITOREO ASÍNCRONO\n";

echo "[" . date('H:i:s') . "] Servidor iniciado en ws://0.0.0.0:8080\n";
echo "[" . date('H:i:s') . "] Modo DB: Asíncrono (react/mysql)\n\n";

$loop->run();