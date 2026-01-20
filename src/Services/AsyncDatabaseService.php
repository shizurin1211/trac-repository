<?php
namespace App\Services;

use React\MySQL\ConnectionInterface;
use React\MySQL\Factory;
use React\Promise\PromiseInterface;
use React\EventLoop\LoopInterface;

class AsyncDatabaseService {
    private ConnectionInterface $conn;

    public function __construct (LoopInterface $loop, array $config = []) 
    {
        $dsn = "{$config[0]}:{$config[1]}@{$config[2]}/{$config[3]}";
        $factory = new Factory($loop);

        $this->conn = $factory->createLazyConnection($dsn);
    }

    public function getDevices () : PromiseInterface 
    {
        return $this->conn->query("SELECT * FROM ip_directions")->then(
            function($result){
                return $result->resultRows;
            });
    }

    public function getDevicesWithNodes() : PromiseInterface 
    {
        $query = "SELECT ipd.*, n.NAME as node_name 
                  FROM ip_directions ipd 
                  LEFT JOIN nodes n ON ipd.ID_NODE = n.ID 
                  ORDER BY ipd.ID_NODE, ipd.ID";
        
        return $this->conn->query($query)->then(
            function($result){
                return $result->resultRows;
            });
    }

    public function getNodes() : PromiseInterface 
    {
        return $this->conn->query("SELECT * FROM nodes ORDER BY NAME")->then(
            function($result){
                return $result->resultRows;
            });
    }

    public function getDevicesByNode($nodeId) : PromiseInterface 
    {
        return $this->conn->query(
            "SELECT * FROM ip_directions WHERE ID_NODE = ? ORDER BY NAME",
            [$nodeId]
        )->then(
            function($result){
                return $result->resultRows;
            });
    }

    public function addNode($name) : PromiseInterface 
    {
        return $this->conn->query(
            "INSERT INTO nodes (NAME) VALUES (?)",
            [$name]
        )->then(
            function($result){
                return [
                    'success' => true, 
                    'id' => $result->insertId,
                    'affectedRows' => $result->affectedRows
                ];
            });
    }

    public function addDevice($name, $ip, $port, $nodeId, $description = '') : PromiseInterface 
    {
        return $this->conn->query(
            "INSERT INTO ip_directions (NAME, IP, PORT, ID_NODE, CREATED_AT) VALUES (?, ?, ?, ?, NOW())",
            [$name, $ip, $port, $nodeId]
        )->then(
            function($result){
                return [
                    'success' => true, 
                    'id' => $result->insertId,
                    'affectedRows' => $result->affectedRows
                ];
            });
    }

    public function updateDevice($id, $name, $ip, $port, $nodeId) : PromiseInterface 
    {
        return $this->conn->query(
            "UPDATE ip_directions SET NAME = ?, IP = ?, PORT = ?, ID_NODE = ? WHERE ID = ?",
            [$name, $ip, $port, $nodeId, $id]
        )->then(
            function($result){
                return [
                    'success' => true, 
                    'affectedRows' => $result->affectedRows
                ];
            });
    }

    public function deleteDevice($id) : PromiseInterface 
    {
        return $this->conn->query(
            "DELETE FROM ip_directions WHERE ID = ?",
            [$id]
        )->then(
            function($result){
                return [
                    'success' => true, 
                    'affectedRows' => $result->affectedRows
                ];
            });
    }

    public function deleteNode($id) : PromiseInterface 
    {
        return $this->conn->query(
            "DELETE FROM ip_directions WHERE ID_NODE = ?",
            [$id]
        )->then(function() use ($id) {
            return $this->conn->query(
                "DELETE FROM nodes WHERE ID = ?",
                [$id]
            );
        })->then(
            function($result){
                return [
                    'success' => true, 
                    'affectedRows' => $result->affectedRows
                ];
            });
    }

    public function nodeExists($name) : PromiseInterface 
    {
        return $this->conn->query(
            "SELECT COUNT(*) as count FROM nodes WHERE NAME = ?",
            [$name]
        )->then(
            function($result){
                $row = $result->resultRows[0] ?? ['count' => 0];
                return $row['count'] > 0;
            });
    }

    public function deviceIpExists($ip, $port, $excludeId = null) : PromiseInterface 
    {
        $query = "SELECT COUNT(*) as count FROM ip_directions WHERE IP = ? AND PORT = ?";
        $params = [$ip, $port];
        
        if ($excludeId !== null) {
            $query .= " AND ID != ?";
            $params[] = $excludeId;
        }
        
        return $this->conn->query($query, $params)->then(
            function($result){
                $row = $result->resultRows[0] ?? ['count' => 0];
                return $row['count'] > 0;
            });
    }

    public function getDeviceById($id) : PromiseInterface 
    {
        return $this->conn->query(
            "SELECT * FROM ip_directions WHERE ID = ?",
            [$id]
        )->then(
            function($result){
                return $result->resultRows[0] ?? null;
            });
    }

    public function getNodeById($id) : PromiseInterface 
    {
        return $this->conn->query(
            "SELECT * FROM nodes WHERE ID = ?",
            [$id]
        )->then(
            function($result){
                return $result->resultRows[0] ?? null;
            });
    }

    public function updateNode($id, $name) : PromiseInterface 
    {
        return $this->conn->query(
            "UPDATE nodes SET NAME = ? WHERE ID = ?",
            [$name, $id]
        )->then(
            function($result){
                return [
                    'success' => true, 
                    'affectedRows' => $result->affectedRows
                ];
            });
    }
}
?>