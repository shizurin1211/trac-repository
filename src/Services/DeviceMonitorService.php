<?php

namespace App\Services;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use React\EventLoop\LoopInterface;
use React\Socket\Connector;
use React\Promise;

class DeviceMonitorService implements MessageComponentInterface
{
    protected $clients;
    protected LoopInterface $loop;
    protected AsyncDatabaseService $asyncDbService;
    protected $isMonitoring = false;
    protected $nodesCache = [];

    public function __construct(LoopInterface $loop, AsyncDatabaseService $asyncDbService)
    {
        $this->clients = new \SplObjectStorage;
        $this->loop = $loop;
        $this->asyncDbService = $asyncDbService;

        $this->loadNodesCache();
        $this->startMonitoring();
    }

    public function onOpen(ConnectionInterface $conn)
    {
        $this->clients->attach($conn);
        echo "[" . date('H:i:s') . "] Cliente {$conn->resourceId} conectado | Total: {$this->clients->count()}\n";

        $conn->send(json_encode([
            'type' => 'welcome',
            'message' => 'Conectado al sistema de monitoreo',
            'client_id' => $conn->resourceId
        ]));

        $this->sendInitialData($conn);

        if (!$this->isMonitoring) {
            $this->performDeviceCheck();
        }
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        $data = json_decode($msg, true);

        if ($data && isset($data['type'])) {
            switch ($data['type']) {
                case 'force_check':
                    echo "[" . date('H:i:s') . "] [CHECK] Cliente {$from->resourceId} solicito chequeo forzado\n";
                    if (!$this->isMonitoring) {
                        $this->performDeviceCheck();
                    }
                    break;

                case 'get_nodes':
                    echo "[" . date('H:i:s') . "] [NODES] Cliente {$from->resourceId} solicito lista de nodos\n";
                    $this->sendNodesList($from);
                    break;

                case 'add_node':
                    echo "[" . date('H:i:s') . "] [ADD] Cliente {$from->resourceId} agregando nodo: {$data['name']}\n";
                    $this->addNode($from, $data['name']);
                    break;

                case 'add_device':
                    echo "[" . date('H:i:s') . "] [ADD] Cliente {$from->resourceId} agregando dispositivo\n";
                    $this->addDevice($from, $data);
                    break;

                case 'update_device':
                    echo "[" . date('H:i:s') . "] [UPDATE] Cliente {$from->resourceId} actualizando dispositivo {$data['id']}\n";
                    $this->updateDevice($from, $data);
                    break;

                case 'delete_device':
                    echo "[" . date('H:i:s') . "] [DELETE] Cliente {$from->resourceId} eliminando dispositivo {$data['id']}\n";
                    $this->deleteDevice($from, $data['id']);
                    break;

                case 'delete_node':
                    echo "[" . date('H:i:s') . "] [DELETE] Cliente {$from->resourceId} eliminando nodo {$data['id']}\n";
                    $this->deleteNode($from, $data['id']);
                    break;

                case 'update_node':
                    echo "[" . date('H:i:s') . "] [UPDATE] Cliente {$from->resourceId} actualizando nodo {$data['id']}\n";
                    $this->updateNode($from, $data['id'], $data['name']);
                    break;

                case 'ping':
                    $from->send(json_encode(['type' => 'pong', 'timestamp' => date('H:i:s')]));
                    break;
            }
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        $this->clients->detach($conn);
        echo "[" . date('H:i:s') . "] [DISCONNECT] Cliente {$conn->resourceId} desconectado | Restantes: {$this->clients->count()}\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        echo "[" . date('H:i:s') . "] [ERROR] Error en cliente {$conn->resourceId}: {$e->getMessage()}\n";
        $conn->close();
    }

    private function loadNodesCache()
    {
        $this->asyncDbService->getNodes()->then(
            function ($nodes) {
                $this->nodesCache = $nodes;
                echo "[" . date('H:i:s') . "] [CACHE] Cargados " . count($nodes) . " nodos en cache\n";
            },
            function ($error) {
                echo "[" . date('H:i:s') . "] [ERROR] Error cargando nodos: " . $error->getMessage() . "\n";
            }
        );
    }

    private function sendInitialData(ConnectionInterface $conn)
    {
        $this->asyncDbService->getDevicesWithNodes()->then(
            function ($devices) use ($conn) {
                $groupedData = $this->groupDevicesByNode($devices);

                $conn->send(json_encode([
                    'type' => 'initial_data',
                    'data' => $groupedData,
                    'timestamp' => date('Y-m-d H:i:s')
                ]));

                echo "[" . date('H:i:s') . "] [SEND] Datos iniciales enviados al cliente {$conn->resourceId}\n";
            },
            function ($error) use ($conn) {
                $conn->send(json_encode([
                    'type' => 'error',
                    'message' => 'Error al cargar datos iniciales: ' . $error->getMessage(),
                    'timestamp' => date('Y-m-d H:i:s')
                ]));
            }
        );
    }

    private function groupDevicesByNode($devices)
    {
        $grouped = [];
        foreach ($devices as $device) {
            $nodeId = $device['ID_NODE'] ?: 0;
            $nodeName = $device['node_name'] ?: 'Sin Nodo';

            if (!isset($grouped[$nodeId])) {
                $grouped[$nodeId] = [
                    'id' => $nodeId,
                    'name' => $nodeName,
                    'devices' => []
                ];
            }

            $grouped[$nodeId]['devices'][] = [
                'id' => $device['ID'],
                'name' => $device['NAME'],
                'ip' => $device['IP'],
                'port' => $device['PORT'],
                'created_at' => $device['CREATED_AT'],
                'status' => 'unknown',
                'last_check' => 'Nunca',
                'description' => 'Dispositivo de red'
            ];
        }
        return array_values($grouped);
    }

    private function sendNodesList(ConnectionInterface $conn)
    {
        $this->asyncDbService->getNodes()->then(
            function ($nodes) use ($conn) {
                $conn->send(json_encode([
                    'type' => 'nodes_list',
                    'data' => $nodes,
                    'timestamp' => date('Y-m-d H:i:s')
                ]));
            },
            function ($error) use ($conn) {
                $conn->send(json_encode([
                    'type' => 'error',
                    'message' => 'Error obteniendo nodos: ' . $error->getMessage()
                ]));
            }
        );
    }

    private function addNode(ConnectionInterface $from, $name)
    {
        $this->asyncDbService->addNode($name)->then(
            function ($result) use ($from, $name) {
                if ($result['success']) {
                    $this->loadNodesCache();
                    $response = [
                        'type' => 'node_added',
                        'id' => $result['id'],
                        'name' => $name,
                        'message' => 'Nodo agregado exitosamente'
                    ];
                    $from->send(json_encode($response));
                    $this->broadcast([
                        'type' => 'node_update',
                        'action' => 'added',
                        'node' => ['id' => $result['id'], 'name' => $name]
                    ]);
                    echo "[" . date('H:i:s') . "] [OK] Nodo '{$name}' agregado (ID: {$result['id']})\n";
                }
            },
            function ($error) use ($from) {
                $from->send(json_encode([
                    'type' => 'error',
                    'message' => 'Error agregando nodo: ' . $error->getMessage()
                ]));
            }
        );
    }

    private function addDevice(ConnectionInterface $from, $data)
    {
        $this->asyncDbService->addDevice(
            $data['name'],
            $data['ip'],
            $data['port'],
            $data['node_id'],
            $data['description'] ?? ''
        )->then(
            function ($result) use ($from, $data) {
                if ($result['success']) {
                    $this->checkSingleDevice($result['id'], $data);
                    $response = [
                        'type' => 'device_added',
                        'id' => $result['id'],
                        'message' => 'Dispositivo agregado exitosamente'
                    ];
                    $from->send(json_encode($response));
                    $this->performDeviceCheck();
                    echo "[" . date('H:i:s') . "] [OK] Dispositivo '{$data['name']}' agregado (ID: {$result['id']})\n";
                }
            },
            function ($error) use ($from) {
                $from->send(json_encode([
                    'type' => 'error',
                    'message' => 'Error agregando dispositivo: ' . $error->getMessage()
                ]));
            }
        );
    }

    private function checkSingleDevice($deviceId, $deviceData)
    {
        $connector = new Connector($this->loop, [
            'timeout' => 3.0,
            'tcp' => true,
            'dns' => false
        ]);

        $uri = "tcp://{$deviceData['ip']}:{$deviceData['port']}";

        $connector->connect($uri)->then(
            function ($connection) use ($deviceId, $deviceData) {
                $connection->close();
                $this->broadcast([
                    'type' => 'device_status_update',
                    'device' => [
                        'id' => $deviceId,
                        'status' => 'online',
                        'last_check' => date('H:i:s')
                    ]
                ]);
            },
            function ($exception) use ($deviceId) {
                $this->broadcast([
                    'type' => 'device_status_update',
                    'device' => [
                        'id' => $deviceId,
                        'status' => 'offline',
                        'last_check' => date('H:i:s'),
                        'error' => $exception->getMessage()
                    ]
                ]);
            }
        );
    }

    private function updateDevice(ConnectionInterface $from, $data)
    {
        $this->asyncDbService->updateDevice(
            $data['id'],
            $data['name'],
            $data['ip'],
            $data['port'],
            $data['node_id']
        )->then(
            function ($result) use ($from, $data) {
                if ($result['success']) {
                    $from->send(json_encode([
                        'type' => 'device_updated',
                        'message' => 'Dispositivo actualizado exitosamente'
                    ]));
                    $this->performDeviceCheck();
                }
            },
            function ($error) use ($from) {
                $from->send(json_encode([
                    'type' => 'error',
                    'message' => 'Error actualizando dispositivo: ' . $error->getMessage()
                ]));
            }
        );
    }

    private function deleteDevice(ConnectionInterface $from, $deviceId)
    {
        $this->asyncDbService->deleteDevice($deviceId)->then(
            function ($result) use ($from, $deviceId) {
                if ($result['success']) {
                    $from->send(json_encode([
                        'type' => 'device_deleted',
                        'id' => $deviceId,
                        'message' => 'Dispositivo eliminado exitosamente'
                    ]));
                    $this->broadcast([
                        'type' => 'device_update',
                        'action' => 'deleted',
                        'device_id' => $deviceId
                    ]);
                }
            },
            function ($error) use ($from) {
                $from->send(json_encode([
                    'type' => 'error',
                    'message' => 'Error eliminando dispositivo: ' . $error->getMessage()
                ]));
            }
        );
    }

    private function deleteNode(ConnectionInterface $from, $nodeId)
    {
        $this->asyncDbService->deleteNode($nodeId)->then(
            function ($result) use ($from, $nodeId) {
                if ($result['success']) {
                    $from->send(json_encode([
                        'type' => 'node_deleted',
                        'id' => $nodeId,
                        'message' => 'Nodo y sus dispositivos eliminados exitosamente'
                    ]));
                    $this->loadNodesCache();
                    $this->broadcast([
                        'type' => 'node_update',
                        'action' => 'deleted',
                        'node_id' => $nodeId
                    ]);
                }
            },
            function ($error) use ($from) {
                $from->send(json_encode([
                    'type' => 'error',
                    'message' => 'Error eliminando nodo: ' . $error->getMessage()
                ]));
            }
        );
    }

    private function startMonitoring()
    {
        $this->loop->addPeriodicTimer(10.0, function () {
            if ($this->clients->count() > 0 && !$this->isMonitoring) {
                $this->performDeviceCheck();
            }
        });
        echo "[" . date('H:i:s') . "] [TIMER] Monitoreo automatico activado (cada 10s con clientes)\n";
    }

    private function performDeviceCheck()
    {
        if ($this->isMonitoring) {
            echo "[" . date('H:i:s') . "] [WAIT] Monitoreo ya en curso, omitiendo...\n";
            return;
        }

        $this->isMonitoring = true;
        echo "[" . date('H:i:s') . "] [SCAN] Iniciando escaneo de dispositivos...\n";

        $this->asyncDbService->getDevicesWithNodes()->then(
            function (array $devices) {
                if (empty($devices)) {
                    echo "[" . date('H:i:s') . "] [INFO] No hay dispositivos para monitorear\n";
                    $this->isMonitoring = false;
                    $this->sendUpdateToClients([]);
                    return;
                }

                echo "[" . date('H:i:s') . "] [DB] Encontrados " . count($devices) . " dispositivos en DB\n";

                $promises = [];
                $connector = new Connector($this->loop, [
                    'timeout' => 3.0,
                    'tcp' => true,
                    'dns' => false
                ]);

                foreach ($devices as $device) {
                    $device = array_merge([
                        'ID' => 0,
                        'NAME' => 'Unknown',
                        'IP' => '',
                        'PORT' => 0,
                        'ID_NODE' => 0,
                        'node_name' => 'Unknown Node'
                    ], $device);
                    $promises[] = $this->checkDevice($connector, $device);
                }

                Promise\all($promises)->then(
                    function ($results) {
                        $groupedResults = $this->groupCheckedDevicesByNode($results);
                        $this->sendUpdateToClients($groupedResults);
                        $this->isMonitoring = false;
                    },
                    function ($error) {
                        echo "[" . date('H:i:s') . "] [ERROR] Error en chequeo de dispositivos: " . $error->getMessage() . "\n";
                        $this->isMonitoring = false;
                    }
                );
            },
            function (\Exception $e) {
                echo "[" . date('H:i:s') . "] [ERROR] Error al obtener dispositivos de DB: " . $e->getMessage() . "\n";
                $this->isMonitoring = false;
                $this->sendErrorToClients("Error de base de datos: " . $e->getMessage());
            }
        );
    }

    private function checkDevice($connector, $device)
    {
        $startTime = microtime(true);
        $uri = "tcp://{$device['IP']}:{$device['PORT']}";

        return $connector->connect($uri)->then(
            function ($connection) use ($startTime, $device) {
                $latency = round((microtime(true) - $startTime) * 1000, 2);
                $connection->close();
                echo "[" . date('H:i:s') . "] [ONLINE] {$device['NAME']} ({$device['IP']}:{$device['PORT']}) - ({$latency}ms)\n";

                return [
                    'id' => $device['ID'],
                    'name' => $device['NAME'],
                    'ip' => $device['IP'],
                    'port' => $device['PORT'],
                    'node_id' => $device['ID_NODE'],
                    'node_name' => $device['node_name'],
                    'status' => 'online',
                    'latency' => $latency,
                    'last_check' => date('H:i:s')
                ];
            },
            function ($exception) use ($startTime, $device) {
                $latency = round((microtime(true) - $startTime) * 1000, 2);
                $errorMsg = $exception->getMessage();
                echo "[" . date('H:i:s') . "] [OFFLINE] {$device['NAME']} ({$device['IP']}:{$device['PORT']}) - ({$errorMsg})\n";

                return [
                    'id' => $device['ID'],
                    'name' => $device['NAME'],
                    'ip' => $device['IP'],
                    'port' => $device['PORT'],
                    'node_id' => $device['ID_NODE'],
                    'node_name' => $device['node_name'],
                    'status' => 'offline',
                    'latency' => $latency,
                    'error' => $errorMsg,
                    'last_check' => date('H:i:s')
                ];
            }
        );
    }

    private function groupCheckedDevicesByNode($devices)
    {
        $grouped = [];
        foreach ($devices as $device) {
            $nodeId = $device['node_id'] ?: 0;
            $nodeName = $device['node_name'] ?: 'Sin Nodo';

            if (!isset($grouped[$nodeId])) {
                $grouped[$nodeId] = [
                    'id' => $nodeId,
                    'name' => $nodeName,
                    'devices' => []
                ];
            }
            $grouped[$nodeId]['devices'][] = $device;
        }

        foreach ($grouped as $nodeId => &$node) {
            $onlineCount = 0;
            $totalCount = count($node['devices']);

            foreach ($node['devices'] as $device) {
                if ($device['status'] === 'online') {
                    $onlineCount++;
                }
            }

            if ($totalCount === 0) {
                $node['status'] = 'unknown';
            } else if ($onlineCount === 0) {
                $node['status'] = 'offline';
            } else if ($onlineCount === $totalCount) {
                $node['status'] = 'online';
            } else {
                $node['status'] = 'warning';
            }
        }
        return array_values($grouped);
    }

    private function sendUpdateToClients($groupedData)
    {
        $totalDevices = 0;
        $onlineCount = 0;
        $offlineCount = 0;

        foreach ($groupedData as $node) {
            foreach ($node['devices'] as $device) {
                $totalDevices++;
                if ($device['status'] === 'online') {
                    $onlineCount++;
                } else {
                    $offlineCount++;
                }
            }
        }

        $payload = [
            'type' => 'devices_update',
            'data' => $groupedData,
            'timestamp' => date('Y-m-d H:i:s'),
            'total_online' => $onlineCount,
            'total_offline' => $offlineCount,
            'total_devices' => $totalDevices,
            'total_nodes' => count($groupedData)
        ];

        $this->broadcast($payload);

        echo "[" . date('H:i:s') . "] [BROADCAST] Actualizacion enviada a {$this->clients->count()} cliente(s)\n";
        echo "           [STATUS] Estado: {$onlineCount} ONLINE, {$offlineCount} OFFLINE en " . count($groupedData) . " nodos\n";
        echo "----------------------------------------\n";
    }

    private function broadcast($data)
    {
        try {
            $payload = is_string($data) ? $data : json_encode($data, JSON_UNESCAPED_UNICODE);

            if (json_last_error() !== JSON_ERROR_NONE) {
                echo "[" . date('H:i:s') . "] [JSON ERROR] " . json_last_error_msg() . "\n";
                return 0;
            }

            $sentCount = 0;
            foreach ($this->clients as $client) {
                try {
                    $client->send($payload);
                    $sentCount++;
                } catch (\Exception $e) {
                    echo "[" . date('H:i:s') . "] [ERROR] Error enviando a cliente: {$e->getMessage()}\n";
                }
            }
            return $sentCount;
        } catch (\Exception $e) {
            echo "[" . date('H:i:s') . "] [ERROR] Error en broadcast: {$e->getMessage()}\n";
            return 0;
        }
    }

    private function sendErrorToClients($errorMessage)
    {
        $this->broadcast([
            'type' => 'error',
            'message' => $errorMessage,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
    }

    private function updateNode(ConnectionInterface $from, $nodeId, $name)
    {
        $this->asyncDbService->updateNode($nodeId, $name)->then(
            function ($result) use ($from, $nodeId, $name) {
                if ($result['success']) {
                    $this->loadNodesCache();
                    $response = [
                        'type' => 'node_updated',
                        'id' => $nodeId,
                        'name' => $name,
                        'message' => 'Nodo actualizado exitosamente'
                    ];
                    $from->send(json_encode($response));
                    $this->broadcast([
                        'type' => 'node_update',
                        'action' => 'updated',
                        'node' => ['id' => $nodeId, 'name' => $name]
                    ]);
                    echo "[" . date('H:i:s') . "] [OK] Nodo ID {$nodeId} actualizado a '{$name}'\n";
                }
            },
            function ($error) use ($from) {
                $from->send(json_encode([
                    'type' => 'error',
                    'message' => 'Error actualizando nodo: ' . $error->getMessage()
                ]));
            }
        );
    }
}