package com.syntax.class13;

public class InterviewQuestion2 {

	public static void main(String[] args) {
		/*
		 * write a java program to check whether a given number is prime or not
		 * prime number is greater than1
		 * prime number should meet2 conditions(divisible by one and itself only)
		 * 2(1,2),3(1,2,3),5(1,2,3,4,5)7(2,3,4,5,6,7,)
		 */
     int given=11;
     boolean isPrime=true;
     if(given>1) {
    	 for(int i=2;i<given; i++) {
    		if(given%i==0) {
    			isPrime=false;
    			break;
    		} 
    	 }
     }else {
    	 isPrime=false;
     }
     System.out.println("given number "+given+" is prime? "+isPrime);
	}

}