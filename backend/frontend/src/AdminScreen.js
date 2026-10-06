import { React, useEffect, useState } from 'react'
import axios from 'axios'
import moment from 'moment'
import './cards.css'
import './counter.css'
import './button.css'
import Logout from './Logout'


const AdminScreen = () => {


    const [orders, setOrders] = useState([])
    const [statusValues, setStatusValues] = useState([])






    const updateOrderStatus = async (orderId, status) => {
        try {
            const res = await axios.put('/order/update/order-status', {
                orderId: `${orderId}`,
                status: `${status}`
            })
            console.log(res.data)
            return res.data
        } catch (error) {
            console.log(error)
        }
    }





    useEffect(() => {

        const getOrders = async () => {
            try {
                const res = await axios.get('/order/all')
                // console.log(res.data.order)
                if (res.data.order) {

                    setOrders(res.data.order)
                }
            } catch (error) {
                console.log(error)
            }
        }


        setTimeout(getOrders, 500);

    }, [orders])

    useEffect(() => {

        const getStatusValues = async () => {
            try {
                const res = await axios.get('/order/get/status-values')
                console.log(res.data)
                if (res.data) {
                    setStatusValues(res.data)
                }
            } catch (error) {
                console.log(error)
            }
        }

        setTimeout(getStatusValues, 500)

    }, [statusValues])







    const showOrdersLength = () => {
        if (orders.length < 1) {
            return (
                <h3 className="container">
                    NO Orders!
                </h3>)
        } else {
            return (
                <>

                    <div className="container">
                        <div className="row">

                            <div className="four col-md-12">
                                <div className="counter-box"> <span className="counter">{orders.length}</span>
                                    <p>Total Orders</p>
                                </div>
                            </div>


                        </div>
                    </div>

                </>
            )
        }
    }


    const showStatus = o => (
        <div className="form-group">
            <h3 className="mark mb-4">Status: {o.status}</h3>
            <select
                className="form-control"
                onChange={e => handleStatusChange(e, o._id)}
            >
                <option>Update Status</option>
                {statusValues.map((status, index) => (
                    <option key={index} value={status}>
                        {status}
                    </option>
                ))}
            </select>
        </div>
    );

    const handleStatusChange = async (e, orderId) => {
        // updateOrderStatus(orderId, e.target.value).then(
        //     data => {
        //         if (data.error) {
        //             console.log("Status update failed");
        //         } else {
        //             getOrders();
        //         }
        //     }
        // );

        try {
            await updateOrderStatus(orderId, e.target.value)

        } catch (error) {
            console.log(error)
        }

    };

    const deleteOrder = async(orderId) => {
        // console.log("deleteOrder of ", orderId);
        try {
            await axios.delete(`/order/delete/${orderId}`)
        } catch (error) {
            console.log(error)
        }

    }




    return (
        <>


            {showOrdersLength()}


            {orders.map((o, oIndex) => {
                return (
                    <div
                        className=" container d-flex justify-content-center mt-50 mb-50"
                        key={oIndex}
                        style={{ borderBottom: "5px solid indigo" }}
                    >
                        <div className="mt-5 mb-5 row">

                            <div className="col-md-10 card card-body">
                                <div className="">

                                    <div>
                                        <img className="" src={o.image} alt={o.product} />
                                    </div>

                                    <div className="content">
                                        <p className="txt4">
                                            <span className="bg-warning">
                                                Order ID: {o._id}
                                            </span>
                                        </p>
                                    </div>

                                    <ul className="list-group mb-2">
                                        <li className="list-group-item">
                                            {showStatus(o)}
                                        </li>
                                        <li className="list-group-item">
                                            Product Name: {o.product}
                                        </li>
                                        <li className="list-group-item">
                                            Amount: ${o.price}
                                        </li>
                                        <li className="list-group-item">
                                            {/* Ordered by: {o.userName} */}
                                            User Id: {o.userId}
                                        </li>
                                        <li className="list-group-item">
                                            Ordered by: {o.userName}
                                            {/* Ordered by: {o.userId} */}
                                        </li>
                                        <li className="list-group-item">
                                            Ordered on:{" "}
                                            {moment(o.createdAt).fromNow()}
                                        </li>
                                        <li className="list-group-item">
                                            Delivery address: {o.address}
                                        </li>
                                        <li className="list-group-item">
                                            Product Url : <a href={o.productUrl} target="_blank" rel="noopener noreferrer">Goto AliExpress Site</a>
                                        </li>
                                    </ul>
                                    <div className="container">
                                        <div className="row">
                                            <div className="col-sm-3">
                                                <button className="btn btn-lg" href="/" onClick={ () => deleteOrder(o._id)}>
                                                    <span>DeleteOrder</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                );
            })}

            {Logout()}


        </>
    )
}

export default AdminScreen
