package com.syntax.class13;

class araba{
	//class                                            object                         method()
	//template,blueprint                         data,behavior
	String color;//data
	int mpg;     //data
	int speed;   //data
    String make;  //data
	
	 void speak(){
		System.out.println("my colur is "+ color +" I m made in "+make+" and my cunsumption is "+mpg+"my speed is "+speed);
	}
	int sum(int x,int y) {
	int toplam=x+y;
	return toplam;
	
	}
	boolean takim() {
		boolean fener=false;
		return fener;
	}
    
	
	
	
	
	
	 
	 
	 
	}public class ObjectOriented {

	public static void main(String[] args) {
		
	araba lexus=new araba();
	araba audi=new araba();
	araba saab=new araba();
	
	lexus.color="silver";//data
	lexus.make="japan";  //data
	lexus.mpg=20;        //data
	lexus.speed=80;      //data
	
	audi.color="blue";
	audi.make="german";
	audi.mpg=80;
	audi.speed=160;
	
	lexus.speak();
	audi.speak();
	System.out.println(lexus.sum(12,35));lexus.sum(12, 35);
	System.out.println(audi.sum(73, 87));
	System.out.println();
	
	}

}
